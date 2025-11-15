import React, { useState } from 'react';

interface ChatHeaderProps {
  projectName: string;
  onSearchChange?: (query: string) => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ projectName, onSearchChange }) => {
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