import React from 'react';

interface ChatHeaderProps {
  projectName: string;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ projectName }) => {
  return (
    <header className="bg-milk-dark/50 backdrop-blur-sm p-4 border-b border-milk-dark-light flex-shrink-0 flex justify-between items-center">
      <h2 className="text-xl font-semibold text-white">{projectName}</h2>
      <div className="flex items-center space-x-4">
        <button className="text-milk-slate-light hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
        </button>
        <button className="text-milk-slate-light hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </header>
  );
};

export default ChatHeader;