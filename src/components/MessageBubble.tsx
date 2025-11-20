import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, AgentProposedChanges } from '../../types';
import CodeBlock from './CodeBlock';
import ProposedChangesViewer from './ProposedChangesViewer';

interface MessageBubbleProps {
  message: Message;
  isGrouped?: boolean;
  onEdit?: (messageId: string, content: string) => void;
  onResend?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  isLastMessage?: boolean;
  isLastUserMessage?: boolean;
  onApproveChanges?: (messageId: string, changes: AgentProposedChanges) => void;
  onRejectChanges?: (messageId: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isGrouped = false,
  onEdit,
  onResend,
  onRegenerate,
  isLastMessage = false,
  isLastUserMessage = false,
  onApproveChanges,
  onRejectChanges,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);

  // Update countdown every second for queued messages
  React.useEffect(() => {
    if (!message.queuedUntil) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const queuedTime = new Date(message.queuedUntil!).getTime();
      const remaining = Math.max(0, Math.ceil((queuedTime - now) / 1000));
      setCountdown(remaining);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [message.queuedUntil]);

  // Filter out internal task maps from display
  const filterTaskMap = (content: string): string => {
    // Remove ```json_task_map blocks (internal machine-readable data)
    const taskMapRegex = /```json_task_map\s*\n?([\s\S]*?)\n?```/g;
    return content.replace(taskMapRegex, '').trim();
  };

  const contentToRender = filterTaskMap(message.content);

  const isUser = message.author === 'Ethan';
  const author = message.author === 'Ethan'
    ? { name: 'Ethan', avatar: 'E', color: '#4A6C82' } // Use milk-slate for user
    : message.author;

  const bubbleClasses = message.isError
    ? 'bg-red-900/20 border-2 border-red-500/50 text-red-200 self-start'
    : isUser
    ? 'bg-milk-slate text-white self-end'
    : 'bg-milk-dark text-milk-lightest self-start';

  const containerClasses = isUser
    ? 'flex flex-row-reverse items-start gap-3'
    : 'flex flex-row items-start gap-3';

  const formatTimestamp = (date: Date): string => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSaveEdit = () => {
    if (onEdit && editedContent.trim() !== message.content) {
      onEdit(message.id, editedContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(message.content);
    setIsEditing(false);
  };

  const handleCopyMessage = async () => {
    // Copy filtered content (without internal task maps)
    await navigator.clipboard.writeText(contentToRender);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
    
  return (
    <div className={containerClasses}>
      {/* Avatar - hidden when grouped */}
      {!isGrouped ? (
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
          style={{ backgroundColor: author.color }}
          title={author.name}
        >
          {author.avatar}
        </div>
      ) : (
        <div className="w-9 h-9 flex-shrink-0" /> // Spacer to maintain alignment
      )}

      {/* Message Content */}
      <div className={`flex flex-col max-w-2xl`}>
          {!isGrouped && (
            <div className="flex items-center mb-1">
                <span className="font-semibold text-sm text-milk-light">{author.name}</span>
                {message.queuedUntil ? (
                  <span className="text-xs text-yellow-400 ml-2 flex items-center gap-1">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending in {countdown}s (rate limit)
                  </span>
                ) : (
                  <span className="text-xs text-milk-slate-light ml-2">{formatTimestamp(message.timestamp)}</span>
                )}
            </div>
          )}

          {/* Edit Mode */}
          {isEditing ? (
            <div className="flex flex-col gap-2 w-full">
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full min-h-[100px] bg-milk-darkest border border-milk-slate rounded-md p-3 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-milk-slate"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleCancelEdit}
                  className="px-3 py-1 text-sm bg-milk-dark-light text-milk-light rounded hover:bg-milk-slate/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-1 text-sm bg-milk-slate text-white rounded hover:bg-milk-slate-dark transition-colors"
                >
                  Save & Resend
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={`relative group p-4 rounded-xl ${bubbleClasses} prose prose-invert max-w-none`}>
                {/* Error icon for error messages */}
                {message.isError && (
                  <div className="flex items-center gap-2 mb-2 text-red-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-semibold text-sm">Error</span>
                  </div>
                )}
                {/* Copy button for agent messages */}
                {!isUser && (
                  <button
                    onClick={handleCopyMessage}
                    className="absolute right-2 top-2 z-10 px-2 py-1 rounded-md text-xs font-medium transition-all bg-milk-dark-light/80 hover:bg-milk-slate/60 text-milk-lightest border border-milk-slate/30 hover:border-milk-slate opacity-0 group-hover:opacity-100"
                    title="Copy message"
                  >
                    {copied ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </span>
                    )}
                  </button>
                )}
                <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <CodeBlock
                      language={match[1]}
                      value={String(children).replace(/\n$/, '')}
                    />
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                h1: ({ children }) => <h1 className="text-2xl font-bold mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-bold mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-bold mb-2">{children}</h3>,
                table: ({ children }) => <table className="border-collapse border border-milk-slate-light mb-2">{children}</table>,
                th: ({ children }) => <th className="border border-milk-slate-light px-2 py-1 bg-milk-dark-light">{children}</th>,
                td: ({ children }) => <td className="border border-milk-slate-light px-2 py-1">{children}</td>,
                blockquote: ({ children }) => <blockquote className="border-l-4 border-milk-slate pl-4 italic mb-2">{children}</blockquote>,
                a: ({ href, children }) => <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
              }}
            >
              {contentToRender}
            </ReactMarkdown>
          </div>

          {/* Proposed Changes Viewer */}
          {message.proposedChanges && onApproveChanges && onRejectChanges && (
            <ProposedChangesViewer
              proposedChanges={message.proposedChanges}
              onApprove={(changes) => onApproveChanges(message.id, changes)}
              onReject={() => onRejectChanges(message.id)}
            />
          )}

          {/* Action Buttons */}
          {!isGrouped && (
            <div className="flex gap-2 mt-2">
              {isUser && onEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-milk-slate-light hover:text-milk-light transition-colors"
                  title="Edit message"
                >
                  Edit
                </button>
              )}
              {isUser && onResend && isLastUserMessage && (
                <button
                  onClick={() => onResend(message.id)}
                  className="text-xs text-milk-slate-light hover:text-milk-light transition-colors"
                  title="Resend from this message"
                >
                  Resend
                </button>
              )}
              {!isUser && onRegenerate && isLastMessage && (
                <button
                  onClick={() => onRegenerate(message.id)}
                  className="text-xs text-milk-slate-light hover:text-milk-light transition-colors"
                  title="Regenerate response"
                >
                  Regenerate
                </button>
              )}
            </div>
          )}
        </>
          )}
      </div>
    </div>
  );
};

export default MessageBubble;