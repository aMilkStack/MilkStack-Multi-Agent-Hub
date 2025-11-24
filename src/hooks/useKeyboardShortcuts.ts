import { useEffect, RefObject } from 'react';
import { MessageInputHandle } from '../components/MessageInput';

interface ModalHandlers {
  openNewProject: () => void;
  openSettings: () => void;
  openKeyboardShortcuts: () => void;
  closeNewProject: () => void;
  closeSettings: () => void;
  closeKeyboardShortcuts: () => void;
}

interface ModalStates {
  isNewProjectModalOpen: boolean;
  isSettingsModalOpen: boolean;
  isKeyboardShortcutsOpen: boolean;
}

/**
 * Hook to manage global keyboard shortcuts
 */
export const useKeyboardShortcuts = (
  messageInputRef: RefObject<MessageInputHandle | null>,
  modalHandlers: ModalHandlers,
  modalStates: ModalStates
) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      const modKey = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K - Focus message input
      if (modKey && e.key === 'k') {
        e.preventDefault();
        messageInputRef.current?.focus();
      }

      // Cmd/Ctrl + N - New project
      if (modKey && e.key === 'n') {
        e.preventDefault();
        modalHandlers.openNewProject();
      }

      // Cmd/Ctrl + S - Settings
      if (modKey && e.key === 's') {
        e.preventDefault();
        modalHandlers.openSettings();
      }

      // Escape - Close modals
      if (e.key === 'Escape') {
        if (modalStates.isNewProjectModalOpen) modalHandlers.closeNewProject();
        if (modalStates.isSettingsModalOpen) modalHandlers.closeSettings();
        if (modalStates.isKeyboardShortcutsOpen) modalHandlers.closeKeyboardShortcuts();
      }

      // ? - Show keyboard shortcuts (only when not typing)
      if (e.key === '?' && !modKey && !isInputFocused) {
        e.preventDefault();
        modalHandlers.openKeyboardShortcuts();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    messageInputRef,
    modalHandlers,
    modalStates.isNewProjectModalOpen,
    modalStates.isSettingsModalOpen,
    modalStates.isKeyboardShortcutsOpen,
  ]);
};
