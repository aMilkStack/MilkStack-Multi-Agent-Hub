import React, { forwardRef, useState, useMemo } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput, { MessageInputHandle } from './MessageInput';
import { Project, Agent } from '../../types';

interface ChatViewProps {
  activeProject: Project | null;
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  onAddContext: (files: File[]) => void;
  activeAgent: Agent | null;
  onEditMessage?: (messageId: string, content: string) => void;
  onResendFromMessage?: (messageId: string) => void;
  onRegenerateResponse?: (messageId: string) => void;
  onOpenRusty?: () => void;
}

const ChatView = forwardRef<MessageInputHandle, ChatViewProps>(
  ({ activeProject, isLoading, onSendMessage, onAddContext, activeAgent, onEditMessage, onResendFromMessage, onRegenerateResponse, onOpenRusty }, ref) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter messages based on search query
  const filteredMessages = useMemo(() => {
    if (!activeProject || !searchQuery.trim()) {
      return activeProject?.messages || [];
    }

    const query = searchQuery.toLowerCase();
    return activeProject.messages.filter(msg =>
      msg.content.toLowerCase().includes(query) ||
      (typeof msg.author === 'string'
        ? msg.author.toLowerCase().includes(query)
        : msg.author.name.toLowerCase().includes(query))
    );
  }, [activeProject, searchQuery]);
  if (!activeProject) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-milk-darkest text-milk-slate-light">
        <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h2 className="mt-4 text-xl font-medium text-milk-lightest">No Project Selected</h2>
            <p className="mt-1">Select a project from the sidebar or create a new one to begin.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-milk-darkest">
      <ChatHeader projectName={activeProject.name} onSearchChange={setSearchQuery} onOpenRusty={onOpenRusty} />
      <MessageList
        messages={filteredMessages}
        isLoading={isLoading}
        activeAgent={activeAgent}
        onEditMessage={onEditMessage}
        onResendFromMessage={onResendFromMessage}
        onRegenerateResponse={onRegenerateResponse}
      />
      <MessageInput ref={ref} onSendMessage={onSendMessage} onAddContext={onAddContext} />
      {searchQuery && filteredMessages.length === 0 && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center text-milk-slate-light">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg">No messages found</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      )}
    </main>
  );
});

ChatView.displayName = 'ChatView';

export default ChatView;