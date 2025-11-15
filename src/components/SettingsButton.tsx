import React from 'react';

interface SettingsButtonProps {
    onClick: () => void;
}

const SettingsButton: React.FC<SettingsButtonProps> = ({ onClick }) => {
  return (
    <div className="p-4 border-t border-milk-dark-light flex-shrink-0">
       <button 
          onClick={onClick}
          className="w-full flex items-center justify-center py-2 px-4 bg-milk-dark-light/50 hover:bg-milk-dark-light rounded-lg transition-colors text-milk-light font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0l-.1.41a1.5 1.5 0 01-2.1 1.45l-.4-.17c-1.5-.65-3.17.92-2.52 2.42l.17.4c.45 1.05.17 2.27-.67 3.02l-.35.32c-1.2.98-.16 2.92 1.39 3.19l.45.08a1.5 1.5 0 011.45 2.1l-.1.41c-.38 1.56 2.6 1.56 2.98 0l.1-.41a1.5 1.5 0 012.1-1.45l.4.17c1.5.65 3.17-.92 2.52-2.42l-.17-.4a1.5 1.5 0 01.67-3.02l.35-.32c1.2-.98.16-2.92-1.39-3.19l-.45-.08a1.5 1.5 0 01-1.45-2.1l.1-.41zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          Settings
       </button>
    </div>
  );
};

export default SettingsButton;