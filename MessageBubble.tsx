import React from 'react';
import { Message } from './types';
import { AGENTS } from './constants';

interface MessageBubbleProps {
  message: Message;
  isLoading?: boolean;
}

const TypingIndicator = () => (
  <div className="flex items-center space-x-1 p-2">
    <div className="w-2 h-2 bg-brand-text-light rounded-full animate-bounce [animation-delay:-0.3s]"></div>
    <div className="w-2 h-2 bg-brand-text-light rounded-full animate-bounce [animation-delay:-0.15s]"></div>
    <div className="w-2 h-2 bg-brand-text-light rounded-full animate-bounce"></div>
  </div>
);

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLoading = false }) => {
  const isUser = message.sender === 'Ethan';

  if (isUser) {
    return (
        <div className="flex items-start space-x-4 justify-end">
            <div className="flex-grow text-right">
                 <div className="flex items-baseline space-x-2 justify-end">
                    <span className="font-bold text-brand-text">{message.sender}</span>
                    <span className="text-xs text-brand-text-light">{message.timestamp}</span>
                </div>
                <div className="bg-brand-primary p-3 rounded-lg mt-1 inline-block max-w-2xl text-left">
                    <p className="text-brand-text leading-relaxed whitespace-pre-wrap">{message.text}</p>
                </div>
            </div>
             <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-brand-text font-bold bg-brand-bg-light`}>
                E
            </div>
        </div>
    );
  }

  const agent = AGENTS.find(a => a.name === message.sender);
  const avatarText = agent?.avatar || message.sender.substring(0, 2).toUpperCase();
  const avatarColor = agent?.color || 'bg-gray-500';

  return (
    <div className="flex items-start space-x-4">
      <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-brand-text font-bold bg-brand-bg-light`}>
        {avatarText}
      </div>
      <div className="flex-grow max-w-2xl">
        <div className="flex items-baseline space-x-2">
          <span className="font-bold text-brand-text">{message.sender}</span>
          <span className="text-xs text-brand-text-light">{message.timestamp}</span>
        </div>
        <div className="bg-brand-bg-light p-3 rounded-lg mt-1 inline-block min-w-[60px]">
          {isLoading ? <TypingIndicator /> : <p className="text-brand-text leading-relaxed whitespace-pre-wrap">{message.text}</p>}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;