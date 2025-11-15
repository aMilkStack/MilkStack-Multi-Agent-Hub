import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  isGrouped?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isGrouped = false }) => {
  const isUser = message.author === 'Ethan';
  const author = message.author === 'Ethan'
    ? { name: 'Ethan', avatar: 'E', color: '#4A6C82' } // Use milk-slate for user
    : message.author;
  
  const bubbleClasses = isUser
    ? 'bg-milk-slate text-white self-end'
    : 'bg-milk-dark text-milk-lightest self-start';

  const containerClasses = isUser
    ? 'flex flex-row-reverse items-start gap-3'
    : 'flex flex-row items-start gap-3';

  const formatTimestamp = (date: Date): string => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                <span className="text-xs text-milk-slate-light ml-2">{formatTimestamp(message.timestamp)}</span>
            </div>
          )}
          <div className={`p-4 rounded-xl ${bubbleClasses} prose prose-invert max-w-none`}>
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
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
              {message.content}
            </ReactMarkdown>
          </div>
      </div>
    </div>
  );
};

export default MessageBubble;