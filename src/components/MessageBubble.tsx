import React from 'react';
import { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
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
      {/* Avatar */}
      <div 
        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
        style={{ backgroundColor: author.color }}
        title={author.name}
      >
        {author.avatar}
      </div>
      
      {/* Message Content */}
      <div className={`flex flex-col max-w-2xl`}>
          <div className="flex items-center mb-1">
              <span className="font-semibold text-sm text-milk-light">{author.name}</span>
              <span className="text-xs text-milk-slate-light ml-2">{formatTimestamp(message.timestamp)}</span>
          </div>
          <div className={`p-4 rounded-xl ${bubbleClasses}`}>
            {/* A simple pre-wrap for now, markdown rendering can be added later */}
            <p className="text-base whitespace-pre-wrap">{message.content}</p>
          </div>
      </div>
    </div>
  );
};

export default MessageBubble;