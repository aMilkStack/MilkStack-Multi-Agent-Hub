import React from 'react';
import { RustyChat } from '../../../types';

interface RustyChatListProps {
  chats: RustyChat[];
  activeChatId?: string;
  onSwitchChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onClose: () => void;
}

/**
 * Dropdown list component for managing Rusty chats
 * Displays all available chats with switch and delete actions
 */
export const RustyChatList: React.FC<RustyChatListProps> = ({
  chats,
  activeChatId,
  onSwitchChat,
  onDeleteChat,
  onClose,
}) => {
  if (chats.length === 0) {
    return (
      <div className="border-b border-milk-dark-light bg-milk-dark/80 max-h-48 overflow-y-auto">
        <div className="p-4 text-center text-milk-slate-light text-sm">
          No chats yet. Click + to create one.
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-milk-dark-light bg-milk-dark/80 max-h-48 overflow-y-auto">
      <div className="divide-y divide-milk-dark-light">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`flex items-center justify-between p-3 hover:bg-milk-dark-light/50 transition-colors cursor-pointer ${
              chat.id === activeChatId ? 'bg-milk-dark-light/30' : ''
            }`}
          >
            <div
              onClick={() => {
                onSwitchChat(chat.id);
                onClose();
              }}
              className="flex-1"
            >
              <div className="text-sm text-milk-lightest font-medium">{chat.name}</div>
              <div className="text-xs text-milk-slate-light">
                {chat.messages.length} messages · {new Date(chat.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete chat "${chat.name}"?`)) {
                  onDeleteChat(chat.id);
                }
              }}
              className="text-red-400 hover:text-red-300 transition-colors p-1"
              title="Delete chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
