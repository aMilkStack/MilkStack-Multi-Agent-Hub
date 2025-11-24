import React, { RefObject } from 'react';
import { RustyMessage } from '../../../types';
import MessageBubble from '../MessageBubble';
import TypingIndicator from '../TypingIndicator';

interface RustyMessagesAreaProps {
  messages: RustyMessage[];
  isLoading: boolean;
  messagesEndRef: RefObject<HTMLDivElement>;
}

/**
 * Messages display area for Rusty Chat
 * Shows chat messages with proper formatting and typing indicator
 */
export const RustyMessagesArea: React.FC<RustyMessagesAreaProps> = ({
  messages,
  isLoading,
  messagesEndRef,
}) => {
  return (
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
                proposedChanges: message.proposedChanges,
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
  );
};
