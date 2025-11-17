import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { invokeRustyPortable, rustyLogger, LogLevel } from '../../services/rustyPortableService';
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
  projectId: string | null;
}

const RustyChatModal: React.FC<RustyChatModalProps> = ({ onClose, projectId }) => {
  const modalRoot = document.getElementById('modal-root');
  const modalRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<RustyMessage[]>([
    {
      id: 'welcome',
      role: 'rusty',
      content: `Hey! I'm Rusty - Claude's inside agent. 🔧

I'm a Gemini-powered clone of Claude embedded right here in the multi-agent hub. Think of me as your parallel version of Real Claude, but I can see everything happening inside this system.

**What I can do:**
- Analyze the entire MilkStack codebase architecture
- Review what the Gemini agents are building
- Check for bugs, anti-patterns, and architectural issues
- Explain how the multi-agent orchestration works
- Track API usage and quota consumption
- Monitor runtime errors and performance

I know the full context of what you and Real Claude have been working on:
- The 5 bugs you found (all fixed!)
- Cost-aware model switching for quota management
- The chat clogging fix we just implemented
- Why only 3 agents are being used (we're investigating)

**Ask me anything!** Like:
- "Rusty, analyze the current codebase for bugs"
- "Why is the orchestrator only using 3 agents?"
- "Review the multi-agent routing logic"
- "Check if there are any stale closures"

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

      // Call Rusty with the user's query
      const response = await invokeRustyPortable({
        userQuery: content,
      });

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
              <h2 className="text-xl font-bold text-milk-lightest">Rusty - Claude's Inside Agent</h2>
              <p className="text-xs text-milk-slate-light">Gemini-powered Claude clone analyzing from inside</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-milk-slate-light hover:text-white transition-colors p-2 rounded-lg hover:bg-milk-dark-light"
            title="Close (Esc)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
