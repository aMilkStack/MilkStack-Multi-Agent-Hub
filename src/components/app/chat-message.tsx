'use client';

import type { Message } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TypingIndicator } from './typing-indicator';
import { MarkdownRenderer } from './markdown-renderer';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.author === 'user';
  const agent = (message.author !== 'user' ? message.author : null);

  return (
    <div className={cn('flex items-start gap-4', isUser ? 'justify-end' : 'justify-start')}>
      {agent && (
        <Avatar className={cn("h-8 w-8 border", agent.color)}>
          <AvatarFallback className="bg-transparent text-white">
            {agent.avatar}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn(
          "max-w-[75%] space-y-2 rounded-lg px-4 py-3",
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}>
        {agent && <p className="font-semibold text-sm">{agent.name}</p>}
        {message.isTyping && !message.content ? (
            <TypingIndicator />
        ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <MarkdownRenderer content={message.content} />
            </div>
        )}
        {!message.isTyping && (
            <p className={cn("text-xs opacity-60", isUser ? 'text-right' : 'text-left')}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
        )}
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 border">
          <AvatarFallback>
            <User className="h-5 w-5" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
