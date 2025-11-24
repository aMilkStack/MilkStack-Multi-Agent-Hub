import React, { RefObject } from 'react';
import { RustyMessage, AgentStatus } from '../../types';
import type { ToolActivity } from '../../types/claude';
import MessageBubble from '../MessageBubble';
import TypingIndicator from '../TypingIndicator';
import { ToolActivityIndicator } from './ToolActivityIndicator';

interface RustyMessagesAreaProps {
  messages: RustyMessage[];
  isLoading: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  /** Optional tool activities to display */
  toolActivities?: ToolActivity[];
  /** Optional streaming content to display */
  streamingContent?: string;
}

/**
 * Messages display area for Rusty Chat
 * Shows chat messages with proper formatting and typing indicator
 */
export const RustyMessagesArea: React.FC<RustyMessagesAreaProps> = ({
  messages,
  isLoading,
  messagesEndRef,
  toolActivities = [],
  streamingContent,
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
                author: 'Ethan',
                content: message.content,
                timestamp: message.timestamp,
              }}
              onEdit={() => {}}
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
                  status: AgentStatus.Active,
                },
                content: message.content,
                timestamp: message.timestamp,
                proposedChanges: message.proposedChanges,
              }}
              onEdit={() => {}}
              onResend={() => {}}
              onRegenerate={() => {}}
            />
          );
        }
      })}

      {/* Show streaming content if available */}
      {streamingContent && (
        <MessageBubble
          key="streaming-message"
          message={{
            id: 'streaming',
            author: {
              id: 'rusty',
              name: 'Rusty',
              avatar: '🔧',
              color: '#ea580c',
              description: "Claude's Inside Agent",
              prompt: '',
              status: AgentStatus.Active,
            },
            content: streamingContent,
            timestamp: new Date(),
          }}
          onEdit={() => {}}
          onResend={() => {}}
          onRegenerate={() => {}}
        />
      )}

      {/* Show tool activities when loading */}
      {isLoading && toolActivities.length > 0 && (
        <div className="ml-13 pl-3 border-l-2 border-orange-500/30">
          <ToolActivityIndicator activities={toolActivities} />
        </div>
      )}

      {isLoading && !streamingContent && (
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg flex-shrink-0">
            🔧
          </div>
          <TypingIndicator agent={{
            id: 'rusty',
            name: 'Rusty',
            avatar: '🔧',
            color: '#ea580c',
            description: "Claude's Inside Agent",
            prompt: '',
            status: AgentStatus.Active,
          }} />
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
