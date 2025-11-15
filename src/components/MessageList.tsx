import React from 'react';
import { Message, Agent } from '../../types';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  activeAgent: Agent | null;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading, activeAgent }) => {
  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="space-y-6">
        {messages.map((msg, index) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isLoading && <TypingIndicator agent={activeAgent} />}
      </div>
    </div>
  );
};

export default MessageList;