import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { toast } from 'react-toastify';
import { invokeRustyPortable, rustyLogger, LogLevel, RustyAnalysis } from '../../services/rustyPortableService';
import { formatRustyFeedback, commitRustyFeedback, getLatestCommitSha } from '../../services/rustyFeedbackService';
import { RUSTY_GLOBAL_CONFIG, getRustyGitHubToken } from '../../config/rustyConfig';
import { RustyChat, RustyMessage } from '../../../types';
import MessageBubble from '../MessageBubble';
import MessageInput from '../MessageInput';
import TypingIndicator from '../TypingIndicator';

interface RustyChatModalProps {
  onClose: () => void;
  apiKey?: string;
  codebaseContext?: string;
  isConnected: boolean;
  onRefreshCodebase: () => Promise<void>;
  rustyChats: RustyChat[];
  activeRustyChatId?: string;
  onNewChat: () => void;
  onSwitchChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onUpdateChat: (chatId: string, messages: RustyMessage[]) => void;
}

const RustyChatModal: React.FC<RustyChatModalProps> = ({
  onClose,
  apiKey,
  codebaseContext,
  isConnected,
  onRefreshCodebase,
  rustyChats,
  activeRustyChatId,
  onNewChat,
  onSwitchChat,
  onDeleteChat,
  onUpdateChat
}) => {
  const modalRoot = document.getElementById('modal-root');
  const modalRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCommittingFeedback, setIsCommittingFeedback] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<RustyAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showChatList, setShowChatList] = useState(false);

  // Get current chat from rustyChats
  const currentChat = rustyChats.find(chat => chat.id === activeRustyChatId);
  const messages = currentChat?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const timerId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleRefreshCodebase = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshCodebase();
    } catch (error) {
      console.error('Error refreshing codebase:', error);
      rustyLogger.log(LogLevel.ERROR, 'RustyChatModal', 'Failed to refresh codebase', { error });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCommitToRustyMd = async () => {
    if (!latestAnalysis) {
      toast.error('No analysis to commit. Ask Rusty to analyze the codebase first.');
      return;
    }

    const token = getRustyGitHubToken();
    if (!token) {
      toast.error('GitHub token required. Set it in Settings to commit rusty.md');
      return;
    }

    setIsCommittingFeedback(true);
    try {
      const { owner, name: repo, branch } = RUSTY_GLOBAL_CONFIG.repo;
      const commitSha = await getLatestCommitSha(owner, repo, branch, token);

      const feedbackMarkdown = formatRustyFeedback(latestAnalysis, commitSha || undefined, branch);

      toast.info(`📝 Writing Rusty's analysis to rusty.md...`);
      await commitRustyFeedback(owner, repo, branch, feedbackMarkdown, token);

      toast.success(`✅ Rusty's analysis committed to rusty.md! Claude Code can now read it.`);

      rustyLogger.log(LogLevel.INFO, 'RustyChatModal', 'Feedback committed to rusty.md', {
        repo: `${owner}/${repo}`,
        branch,
        grade: latestAnalysis.grade,
      });
    } catch (error) {
      console.error('Error committing rusty.md:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to commit rusty.md');
      rustyLogger.log(LogLevel.ERROR, 'RustyChatModal', 'Failed to commit feedback', { error });
    } finally {
      setIsCommittingFeedback(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !activeRustyChatId) return;

    // Add user message
    const userMessage: RustyMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    onUpdateChat(activeRustyChatId, updatedMessages);
    setIsLoading(true);

    try {
      rustyLogger.log(LogLevel.INFO, 'RustyChat', 'User message sent to Rusty', { content });

      // Call Rusty with the user's query and full codebase context (no truncation)
      const response = await invokeRustyPortable({
        userQuery: content,
        sourceFiles: codebaseContext, // Pass full untruncated context
      }, apiKey);

      // Store the latest analysis for potential commit to rusty.md
      setLatestAnalysis(response);

      const rustyMessage: RustyMessage = {
        id: crypto.randomUUID(),
        role: 'rusty',
        content: response.review,
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessages, rustyMessage];
      onUpdateChat(activeRustyChatId, finalMessages);
      rustyLogger.log(LogLevel.INFO, 'RustyChat', 'Rusty response received', {
        grade: response.grade,
        criticalIssues: response.criticalIssues,
      });

    } catch (error) {
      console.error('Error calling Rusty:', error);
      rustyLogger.log(LogLevel.ERROR, 'RustyChat', 'Failed to get Rusty response', { error });

      const errorMessage: RustyMessage = {
        id: crypto.randomUUID(),
        role: 'rusty',
        content: `Oops! I encountered an error: ${error instanceof Error ? error.message : String(error)}

This usually means there's an API key issue or network problem. Check the console for details!`,
        timestamp: new Date(),
      };

      const finalMessages = [...updatedMessages, errorMessage];
      onUpdateChat(activeRustyChatId, finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  if (!modalRoot) {
    return null;
  }

  return ReactDOM.createPortal(
    <div className="fixed inset-y-0 right-0 w-96 bg-milk-dark shadow-2xl border-l border-milk-dark-light z-50 flex flex-col animate-slide-in-right">
      <div ref={modalRef} className="flex flex-col h-full">
        {/* Header */}
        <header className="flex justify-between items-center p-3 border-b border-milk-dark-light flex-shrink-0 bg-gradient-to-r from-orange-600/10 to-red-600/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-md flex items-center justify-center text-white font-bold shadow-lg">
              🔧
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-milk-lightest">Rusty</h2>
                <button
                  onClick={() => setShowChatList(!showChatList)}
                  className="text-milk-slate-light hover:text-white transition-colors"
                  title={showChatList ? "Hide chat list" : "Show chat list"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-milk-slate-light">
                {currentChat?.name || 'No chat selected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onNewChat}
              className="p-1.5 rounded-md text-xs text-green-400 hover:bg-green-500/10 transition-all"
              title="New chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={handleRefreshCodebase}
              disabled={isRefreshing}
              className={`p-1.5 rounded-md text-xs transition-all ${
                isRefreshing
                  ? 'text-milk-slate-light/50 cursor-not-allowed'
                  : 'text-blue-400 hover:bg-blue-500/10'
              }`}
              title="Sync with latest codebase"
            >
              {isRefreshing ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
            {latestAnalysis && (
              <button
                onClick={handleCommitToRustyMd}
                disabled={isCommittingFeedback}
                className={`p-1.5 rounded-md text-xs transition-all ${
                  isCommittingFeedback
                    ? 'text-milk-slate-light/50 cursor-not-allowed'
                    : 'text-green-400 hover:bg-green-500/10'
                }`}
                title="Commit analysis to rusty.md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-milk-slate-light hover:text-white transition-colors p-1.5 rounded-md hover:bg-milk-dark-light"
              title="Close (Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Chat List Dropdown */}
        {showChatList && (
          <div className="border-b border-milk-dark-light bg-milk-dark/80 max-h-48 overflow-y-auto">
            {rustyChats.length === 0 ? (
              <div className="p-4 text-center text-milk-slate-light text-sm">
                No chats yet. Click + to create one.
              </div>
            ) : (
              <div className="divide-y divide-milk-dark-light">
                {rustyChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`flex items-center justify-between p-3 hover:bg-milk-dark-light/50 transition-colors cursor-pointer ${
                      chat.id === activeRustyChatId ? 'bg-milk-dark-light/30' : ''
                    }`}
                  >
                    <div
                      onClick={() => {
                        onSwitchChat(chat.id);
                        setShowChatList(false);
                      }}
                      className="flex-1"
                    >
                      <div className="text-sm text-milk-lightest font-medium">{chat.name}</div>
                      <div className="text-xs text-milk-slate-light">
                        {chat.messages.length} messages · {new Date(chat.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete chat "${chat.name}"?`)) {
                          onDeleteChat(chat.id);
                        }
                      }}
                      className="text-red-400 hover:text-red-300 transition-colors p-1"
                      title="Delete chat"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-milk-slate-light text-sm text-center p-4">
              <p>Type your message below to start chatting with Rusty...</p>
            </div>
          )}
          {messages.map((message) => {
            if (message.role === 'user') {
              return (
                <MessageBubble
                  key={message.id}
                  message={{
                    id: message.id,
                    author: 'You',
                    content: message.content,
                    timestamp: message.timestamp,
                  }}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onResend={() => {}}
                  onRegenerate={() => {}}
                />
              );
            } else {
              return (
                <MessageBubble
                  key={message.id}
                  message={{
                    id: message.id,
                    author: {
                      id: 'rusty',
                      name: 'Rusty',
                      avatar: '🔧',
                      color: '#ea580c', // orange-600
                      description: "Claude's Inside Agent",
                      prompt: '',
                      status: 'active' as const,
                    },
                    content: message.content,
                    timestamp: message.timestamp,
                  }}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onResend={() => {}}
                  onRegenerate={() => {}}
                />
              );
            }
          })}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
                🔧
              </div>
              <TypingIndicator agentName="Rusty" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-milk-dark-light p-2 flex-shrink-0">
          <MessageInput
            onSendMessage={handleSendMessage}
            onAddContext={() => {}}
            apiKey={apiKey}
          />
        </div>
      </div>
    </div>,
    modalRoot
  );
};

export default RustyChatModal;
