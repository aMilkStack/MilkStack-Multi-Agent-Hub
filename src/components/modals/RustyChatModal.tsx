import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { toast } from 'react-toastify';
import { invokeRustyPortable, rustyLogger, LogLevel, RustyAnalysis } from '../../services/rustyPortableService';
import { formatRustyFeedback, commitRustyFeedback, getLatestCommitSha } from '../../services/rustyFeedbackService';
import { RUSTY_GLOBAL_CONFIG, getRustyGitHubToken } from '../../config/rustyConfig';
import MessageBubble from '../MessageBubble';
import MessageInput from '../MessageInput';
import TypingIndicator from '../TypingIndicator';

interface RustyMessage {
  id: string;
  role: 'user' | 'rusty';
  content: string;
  timestamp: Date;
}

interface RustyChatModalProps {
  onClose: () => void;
  apiKey?: string;
  codebaseContext?: string;
  isConnected: boolean;
  onRefreshCodebase: () => Promise<void>;
}

const RustyChatModal: React.FC<RustyChatModalProps> = ({
  onClose,
  apiKey,
  codebaseContext,
  isConnected,
  onRefreshCodebase
}) => {
  const modalRoot = document.getElementById('modal-root');
  const modalRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCommittingFeedback, setIsCommittingFeedback] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<RustyAnalysis | null>(null);
  const [messages, setMessages] = useState<RustyMessage[]>([
    {
      id: 'welcome',
      role: 'rusty',
      content: `Hey! I'm Rusty - Claude's inside agent. 🔧

I'm a **meta-level global agent** always connected to the MilkStack Multi-Agent Hub repository. I'm not project-specific - I'm here to watch, test, and monitor the entire system.

**What I can do:**
- Analyze the entire MilkStack codebase architecture
- Review what the Gemini agents are building
- Check for bugs, anti-patterns, and architectural issues
- Explain how the multi-agent orchestration works
- Monitor the codebase continuously
- Write feedback to rusty.md for Claude Code to read

**I'm always connected to:**
- Repository: ${RUSTY_GLOBAL_CONFIG.repo.owner}/${RUSTY_GLOBAL_CONFIG.repo.name}
- Branch: ${RUSTY_GLOBAL_CONFIG.repo.branch}
- Status: ${isConnected ? '✅ Connected' : '⚠️ Connecting...'}

**Ask me anything!** Like:
- "Rusty, analyze the current codebase for bugs"
- "Why is the orchestrator only using 3 agents?"
- "Review the multi-agent routing logic"
- "What's the architecture of this system?"

I'll respond in Claude's voice because I'm literally trained to think and talk like him. Let's dive in!`,
      timestamp: new Date(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

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
    if (!content.trim()) return;

    // Add user message
    const userMessage: RustyMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
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

      setMessages(prev => [...prev, rustyMessage]);
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

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!modalRoot) {
    return null;
  }

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-milk-darkest/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-milk-dark rounded-lg shadow-2xl border border-milk-dark-light w-full max-w-4xl mx-4 flex flex-col"
        style={{ height: '80vh', maxHeight: '800px' }}
      >
        {/* Header */}
        <header className="flex justify-between items-center p-4 border-b border-milk-dark-light flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
              🔧
            </div>
            <div>
              <h2 className="text-xl font-bold text-milk-lightest">Rusty - Meta Code Guardian</h2>
              <div className="flex items-center gap-2">
                <p className="text-xs text-milk-slate-light">
                  {RUSTY_GLOBAL_CONFIG.repo.owner}/{RUSTY_GLOBAL_CONFIG.repo.name}
                </p>
                <span className={`text-xs ${isConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                  {isConnected ? '✅ Connected' : '⚠️ Connecting...'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshCodebase}
              disabled={isRefreshing}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isRefreshing
                  ? 'bg-milk-slate/50 text-milk-slate-light cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title="Sync with latest codebase"
            >
              {isRefreshing ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Syncing...
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  🔄 Sync
                </span>
              )}
            </button>
            {latestAnalysis && (
              <button
                onClick={handleCommitToRustyMd}
                disabled={isCommittingFeedback}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isCommittingFeedback
                    ? 'bg-milk-slate/50 text-milk-slate-light cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
                title="Commit analysis to rusty.md for Claude Code to read"
              >
                {isCommittingFeedback ? (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Writing...
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    📝 Write to rusty.md
                  </span>
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-milk-slate-light hover:text-white transition-colors p-2 rounded-lg hover:bg-milk-dark-light"
              title="Close (Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
        <div className="border-t border-milk-dark-light p-4 flex-shrink-0">
          <MessageInput
            onSendMessage={handleSendMessage}
            onAddContext={() => {}}
          />
          <div className="mt-2 text-xs text-milk-slate-light">
            💡 Try: "Analyze the current codebase" • "Why only 3 agents used?" • "Check for stale closures"
          </div>
        </div>
      </div>
    </div>,
    modalRoot
  );
};

export default RustyChatModal;
