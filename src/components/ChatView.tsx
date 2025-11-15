import React, { useState, useRef, useEffect } from 'react';
import { Message, Model, Project } from '../types';
import MessageBubble from './MessageBubble';
import ModelSelector from './ModelSelector';

interface ChatViewProps {
  project: Project;
  messages: Message[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  selectedModel: Model;
  onModelChange: (model: Model) => void;
}

const CollaborationIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.282-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.282.356-1.857m0 0a3.004 3.004 0 014.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const ChatView: React.FC<ChatViewProps> = ({ project, messages, onSendMessage, isLoading, selectedModel, onModelChange }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isLoading]);
  
  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <main className="w-3/4 h-full flex flex-col bg-brand-bg-dark">
      <header className="flex items-center justify-between p-5 border-b border-white/10">
        <div className="flex items-center">
            <CollaborationIcon />
            <div>
                <h2 className="text-xl font-bold text-brand-text">{project.title}</h2>
                <p className="text-sm text-brand-text-light">{project.description}</p>
            </div>
        </div>
        <ModelSelector selectedModel={selectedModel} onModelChange={onModelChange} />
      </header>
      
      <div className="flex-grow p-6 overflow-y-auto">
        <div className="space-y-6">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && <MessageBubble message={{id: 'processing', sender: 'Orchestrator', text: '...', timestamp: ''}} isLoading={true}/>}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      <div className="p-6 border-t border-white/10">
          <div className="bg-brand-bg-light rounded-lg p-2 flex items-center focus-within:ring-2 focus-within:ring-brand-secondary">
            <textarea
              className="flex-grow bg-transparent p-2 text-brand-text placeholder-brand-text-light resize-none focus:outline-none"
              placeholder="Send a message to the staff..."
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
          </div>
          <p className="text-xs text-brand-text-light mt-2">Press Enter to send, Shift + Enter for new line</p>
      </div>
    </main>
  );
};

export default ChatView;
