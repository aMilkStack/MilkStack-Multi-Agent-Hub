import React from 'react';
import { getAuthMethodDisplay, isClaudeAuthenticated } from '../../config/claudeConfig';

interface RustyChatHeaderProps {
  currentChatName?: string;
  showChatList: boolean;
  isRefreshing: boolean;
  onToggleChatList: () => void;
  onNewChat: () => void;
  onRefresh: () => void;
  onClose: () => void;
}

/**
 * Header component for Rusty Chat modal
 * Contains title, chat switcher, refresh button, new chat button, and close button
 */
export const RustyChatHeader: React.FC<RustyChatHeaderProps> = ({
  currentChatName,
  showChatList,
  isRefreshing,
  onToggleChatList,
  onNewChat,
  onRefresh,
  onClose,
}) => {
  return (
    <header className="flex justify-between items-center p-3 border-b border-milk-dark-light flex-shrink-0 bg-gradient-to-r from-orange-600/10 to-red-600/10">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-md flex items-center justify-center text-white font-bold shadow-lg">
          🔧
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-milk-lightest">Rusty</h2>
            <button
              onClick={onToggleChatList}
              className="text-milk-slate-light hover:text-white transition-colors"
              title={showChatList ? "Hide chat list" : "Show chat list"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-milk-slate-light">
              {currentChatName || 'No chat selected'}
            </span>
            <span className="text-milk-slate-light/50">•</span>
            <span className={isClaudeAuthenticated() ? 'text-green-400' : 'text-red-400'}>
              {getAuthMethodDisplay()}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onNewChat}
          className="p-1.5 rounded-md text-xs text-green-400 hover:bg-green-500/10 transition-all"
          title="New chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`p-1.5 rounded-md text-xs transition-all ${
            isRefreshing
              ? 'text-milk-slate-light/50 cursor-not-allowed'
              : 'text-blue-400 hover:bg-blue-500/10'
          }`}
          title="Sync with latest codebase"
        >
          {isRefreshing ? (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
        </button>
        <button
          onClick={onClose}
          className="text-milk-slate-light hover:text-white transition-colors p-1.5 rounded-md hover:bg-milk-dark-light"
          title="Close (Esc)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </header>
  );
};
