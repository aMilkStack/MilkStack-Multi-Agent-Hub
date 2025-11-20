import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { RustyChat } from '../../../types';
import MessageInput from '../MessageInput';
import { RustyChatHeader } from '../rusty/RustyChatHeader';
import { RustyChatList } from '../rusty/RustyChatList';
import { RustyMessagesArea } from '../rusty/RustyMessagesArea';
import { useRustyChat } from '../../hooks/useRustyChat';

interface RustyChatModalProps {
  onClose: () => void;
  apiKey?: string;
  codebaseContext?: string;
  isConnected: boolean;
  onRefreshCodebase: () => Promise<void>;
  rustyChats: RustyChat[];
  activeRustyChatId?: string;
  onNewChat: () => void;
  onSwitchChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onUpdateChat: (chatId: string, messages: any[]) => void;
}

/**
 * Rusty Chat Modal - Sidebar chat interface for the Rusty meta-agent
 * Provides code review and analysis capabilities
 *
 * Refactored into smaller, maintainable components:
 * - RustyChatHeader: Title, buttons, chat switcher
 * - RustyChatList: Dropdown list of available chats
 * - RustyMessagesArea: Message display with typing indicator
 * - useRustyChat: Custom hook for chat logic
 */
const RustyChatModal: React.FC<RustyChatModalProps> = ({
  onClose,
  apiKey,
  codebaseContext,
  isConnected,
  onRefreshCodebase,
  rustyChats,
  activeRustyChatId,
  onNewChat,
  onSwitchChat,
  onDeleteChat,
  onUpdateChat
}) => {
  const modalRoot = document.getElementById('modal-root');
  const modalRef = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showChatList, setShowChatList] = useState(false);

  // Get current chat from rustyChats
  const currentChat = rustyChats.find(chat => chat.id === activeRustyChatId);
  const messages = currentChat?.messages || [];

  // Use custom hook for chat logic
  const {
    isLoading,
    messagesEndRef,
    handleSendMessage,
  } = useRustyChat({
    activeRustyChatId,
    messages,
    codebaseContext,
    apiKey,
    onUpdateChat,
  });

  // Handle escape key and click outside
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const timerId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshCodebase();
    } catch (error) {
      console.error('Error refreshing codebase:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleChatList = () => {
    setShowChatList(prev => !prev);
  };

  const handleCloseChatList = () => {
    setShowChatList(false);
  };

  if (!modalRoot) {
    return null;
  }

  return ReactDOM.createPortal(
    <div className="fixed inset-y-0 right-0 w-96 bg-milk-dark shadow-2xl border-l border-milk-dark-light z-50 flex flex-col animate-slide-in-right">
      <div ref={modalRef} className="flex flex-col h-full">
        {/* Header */}
        <RustyChatHeader
          currentChatName={currentChat?.name}
          showChatList={showChatList}
          isRefreshing={isRefreshing}
          onToggleChatList={handleToggleChatList}
          onNewChat={onNewChat}
          onRefresh={handleRefresh}
          onClose={onClose}
        />

        {/* Chat List Dropdown */}
        {showChatList && (
          <RustyChatList
            chats={rustyChats}
            activeChatId={activeRustyChatId}
            onSwitchChat={onSwitchChat}
            onDeleteChat={onDeleteChat}
            onClose={handleCloseChatList}
          />
        )}

        {/* Messages Area */}
        <RustyMessagesArea
          messages={messages}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
        />

        {/* Input Area */}
        <div className="border-t border-milk-dark-light p-2 flex-shrink-0">
          <MessageInput
            onSendMessage={handleSendMessage}
            onAddContext={() => {}}
            apiKey={apiKey}
          />
        </div>
      </div>
    </div>,
    modalRoot
  );
};

export default RustyChatModal;
