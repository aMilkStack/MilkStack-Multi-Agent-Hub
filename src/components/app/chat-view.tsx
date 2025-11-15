'use client';

import type { Message, AgentStatus } from '@/lib/types';
import { ChatInput } from './chat-input';
import { ChatMessage } from './chat-message';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRef, useEffect } from 'react';

interface ChatViewProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isTyping: boolean;
  agentStatuses: Record<string, AgentStatus>;
  onStopGeneration: () => void;
}

export function ChatView({ messages, onSendMessage, isTyping, agentStatuses, onStopGeneration }: ChatViewProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="mx-auto max-w-4xl space-y-8">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
        </div>
      </ScrollArea>
      <div className="border-t bg-background p-4">
        <div className="mx-auto max-w-4xl">
            <ChatInput onSendMessage={onSendMessage} isTyping={isTyping} onStopGeneration={onStopGeneration} />
        </div>
      </div>
    </div>
  );
}
