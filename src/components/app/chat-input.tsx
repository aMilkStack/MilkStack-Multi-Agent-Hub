'use client';

import { useState, useRef, type FormEvent, useEffect, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, CornerDownLeft } from 'lucide-react';
import { TypingIndicator } from './typing-indicator';
import { Command } from '@/lib/types';
import { COMMANDS } from '@/lib/commands';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AGENTS } from '@/lib/agents';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isTyping: boolean;
}

export function ChatInput({ onSendMessage, isTyping }: ChatInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isCommandPopoverOpen, setCommandPopoverOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const isCommand = content.startsWith('/');
  const commandParts = content.split(' ');
  const commandName = commandParts[0].substring(1);
  
  const filteredCommands = useMemo(() => {
    if (!isCommand) return [];
    return COMMANDS.filter(cmd => cmd.name.startsWith(commandName));
  }, [isCommand, commandName]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (content.trim() && !isTyping) {
      onSendMessage(content.trim());
      setContent('');
      textareaRef.current?.focus();
    }
  };

  useEffect(() => {
    setCommandPopoverOpen(isCommand && filteredCommands.length > 0);
  }, [isCommand, filteredCommands]);
  
  useEffect(() => {
    setActiveSuggestion(0);
  }, [filteredCommands]);

  const handleCommandSelect = (command: Command) => {
    setContent(`/${command.name} `);
    setCommandPopoverOpen(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isCommandPopoverOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestion((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestion((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredCommands[activeSuggestion]) {
          handleCommandSelect(filteredCommands[activeSuggestion]);
        }
      } else if (e.key === 'Escape') {
        setCommandPopoverOpen(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="relative">
    <Popover open={isCommandPopoverOpen} onOpenChange={setCommandPopoverOpen}>
    <PopoverTrigger asChild>
      <form onSubmit={handleSubmit} className="relative">
        {isTyping && (
          <div className="absolute -top-8 left-0 flex items-center gap-2 text-sm text-muted-foreground">
              <TypingIndicator />
              <span>Agents are responding...</span>
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the agents to do something, or type '/' for commands..."
          className="min-h-[60px] resize-none pr-24"
          disabled={isTyping}
          rows={1}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" />
              <span>Send</span>
          </p>
          <Button type="submit" size="icon" disabled={isTyping || !content.trim()}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </form>
    </PopoverTrigger>
      <PopoverContent className="w-[400px] p-1" align="start">
          <ScrollArea className="max-h-72">
            <div className="p-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">COMMANDS</p>
                {filteredCommands.length > 0 ? (
                    filteredCommands.map((command, index) => {
                        const agent = AGENTS.find(a => a.name === command.agent);
                        return (
                            <div 
                                key={command.name}
                                onMouseDown={(e) => { e.preventDefault(); handleCommandSelect(command); }}
                                className={`flex items-center gap-3 p-2 rounded-md cursor-pointer ${index === activeSuggestion ? 'bg-accent' : ''}`}
                            >
                                {agent && (
                                     <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-xs", agent.color)}>
                                        {agent.avatar}
                                    </div>
                                )}
                                <div>
                                    <p className="font-medium text-sm">{command.name}</p>
                                    <p className="text-xs text-muted-foreground">{command.description}</p>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <p className="text-sm text-muted-foreground p-2">No commands found.</p>
                )}
            </div>
          </ScrollArea>
      </PopoverContent>
    </Popover>
    </div>
  );
}
