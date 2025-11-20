import React, { useState } from 'react';

interface ChatHeaderProps {
  projectName: string;
  onSearchChange?: (query: string) => void;
  onOpenRusty?: () => void;
  onOpenProjectSettings?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ projectName, onSearchChange, onOpenRusty, onOpenProjectSettings }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearchChange?.(value);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    onSearchChange?.('');
    setIsSearchOpen(false);
  };

  return (
    <header className="bg-milk-dark/50 backdrop-blur-sm p-4 border-b border-milk-dark-light flex-shrink-0">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">{projectName}</h2>
        <div className="flex items-center space-x-2">
          {isSearchOpen && (
            <div className="flex items-center bg-milk-dark-light rounded-lg px-3 py-1.5 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-milk-slate-light mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search messages..."
                className="bg-transparent text-white text-sm focus:outline-none w-48"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="ml-2 text-milk-slate-light hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <button
            onClick={onOpenRusty}
            className="text-milk-slate-light hover:text-white transition-colors p-1.5 hover:bg-gradient-to-br hover:from-orange-500/20 hover:to-red-600/20 rounded-lg group"
            title="Talk to Rusty - Claude's Inside Agent (Cmd+R)"
          >
            <div className="text-lg leading-none group-hover:scale-110 transition-transform">🔧</div>
          </button>
          <button
            onClick={onOpenProjectSettings}
            className="text-milk-slate-light hover:text-white transition-colors p-1"
            title="Project Settings - Configure API keys per project"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="text-milk-slate-light hover:text-white transition-colors p-1"
            title="Search messages"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;