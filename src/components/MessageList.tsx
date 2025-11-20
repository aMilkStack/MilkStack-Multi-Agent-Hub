import React from 'react';
import { Message, Agent, AgentProposedChanges, ActiveTaskState } from '../../types';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import WorkflowBlock from './WorkflowBlock';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  activeAgent: Agent | null;
  workflowState?: ActiveTaskState; // Current workflow state for rendering workflow blocks
  onEditMessage?: (messageId: string, content: string) => void;
  onResendFromMessage?: (messageId: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
  onStopGeneration?: () => void;
  onApproveChanges?: (messageId: string, changes: AgentProposedChanges) => void;
  onRejectChanges?: (messageId: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  activeAgent,
  workflowState,
  onEditMessage,
  onResendFromMessage,
  onRegenerateResponse,
  onStopGeneration,
  onApproveChanges,
  onRejectChanges,
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

  // Check if the last message is an empty agent message (streaming bubble)
  const lastMessage = messages[messages.length - 1];
  const isAgentStreaming = lastMessage &&
    typeof lastMessage.author !== 'string' &&
    lastMessage.content === '';

  // Only show TypingIndicator if loading AND not already showing a streaming agent bubble
  const showTypingIndicator = isLoading && !isAgentStreaming;

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="space-y-1">
        {messages.map((msg, index) => {
          const isGrouped = shouldGroupWith(msg, messages[index - 1]);
          const nextMessage = messages[index + 1];
          const isLastInGroup = nextMessage ? !shouldGroupWith(nextMessage, msg) : true;
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
                onApproveChanges={onApproveChanges}
                onRejectChanges={onRejectChanges}
              />
            </div>
          );
        })}

        {/* Show workflow block if there's an active workflow */}
        {workflowState && (
          <div className="mt-6">
            <WorkflowBlock workflowState={workflowState} />
          </div>
        )}

        {showTypingIndicator && (
          <>
            <TypingIndicator agent={activeAgent} />
            {onStopGeneration && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={onStopGeneration}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-lg"
                  title="Stop generation (Esc)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="1" />
                  </svg>
                  <span className="text-sm font-medium">Stop</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MessageList;