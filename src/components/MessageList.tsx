import React from 'react';
import { Message, Agent } from '../../types';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  activeAgent: Agent | null;
  onEditMessage?: (messageId: string, content: string) => void;
  onResendFromMessage?: (messageId: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  activeAgent,
  onEditMessage,
  onResendFromMessage,
  onRegenerateResponse,
}) => {
  // Helper function to check if messages should be grouped
  const shouldGroupWith = (current: Message, previous: Message | undefined): boolean => {
    if (!previous) return false;

    const currentAuthorId = typeof current.author === 'string'
      ? current.author
      : current.author.id;
    const previousAuthorId = typeof previous.author === 'string'
      ? previous.author
      : previous.author.id;

    return currentAuthorId === previousAuthorId;
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="space-y-1">
        {messages.map((msg, index) => {
          const isGrouped = shouldGroupWith(msg, messages[index - 1]);
          const isLastInGroup = !shouldGroupWith(messages[index + 1], msg);
          const isLastMessage = index === messages.length - 1;

          // Find the last user message
          const lastUserMessageIndex = messages.map((m, i) => ({ m, i }))
            .reverse()
            .find(({ m }) => m.author === 'Ethan')?.i;
          const isLastUserMessage = index === lastUserMessageIndex;

          return (
            <div
              key={msg.id}
              className={`${isGrouped ? 'mt-1' : 'mt-6'} ${isLastInGroup ? 'mb-4' : ''}`}
            >
              <MessageBubble
                message={msg}
                isGrouped={isGrouped}
                onEdit={onEditMessage}
                onResend={onResendFromMessage}
                onRegenerate={onRegenerateResponse}
                isLastMessage={isLastMessage}
                isLastUserMessage={isLastUserMessage}
              />
            </div>
          );
        })}
        {isLoading && <TypingIndicator agent={activeAgent} />}
      </div>
    </div>
  );
};

export default MessageList;