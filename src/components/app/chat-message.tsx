'use client';

import type { Message } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TypingIndicator } from './typing-indicator';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.author === 'user';

  return (
    <div className={cn('flex items-start gap-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className={cn("h-8 w-8 border", message.author.color)}>
          <AvatarFallback className="bg-transparent text-white">
            {message.author.avatar}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn(
          "max-w-[75%] space-y-2 rounded-lg px-4 py-3", 
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-muted'
        )}>
        {!isUser && <p className="font-semibold text-sm">{message.author.name}</p>}
        {message.isTyping ? (
            <TypingIndicator />
        ) : (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}
        <p className={cn("text-xs opacity-60", isUser ? 'text-right' : 'text-left')}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
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
