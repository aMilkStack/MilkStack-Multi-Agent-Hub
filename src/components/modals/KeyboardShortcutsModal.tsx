import React, { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'General',
      items: [
        { keys: ['?'], description: 'Show keyboard shortcuts' },
        { keys: ['Esc'], description: 'Close modals / Cancel editing' },
        { keys: ['Cmd', 'K'], description: 'Focus message input' },
      ],
    },
    {
      category: 'Message Input',
      items: [
        { keys: ['Cmd', 'Enter'], description: 'Send message' },
        { keys: ['Ctrl', 'Enter'], description: 'Send message (alternative)' },
        { keys: ['/'], description: 'Quick commands (future feature)' },
      ],
    },
    {
      category: 'Navigation',
      items: [
        { keys: ['Cmd', 'N'], description: 'New project' },
        { keys: ['Cmd', 'S'], description: 'Open settings' },
        { keys: ['Cmd', 'F'], description: 'Search messages' },
      ],
    },
    {
      category: 'Projects',
      items: [
        { keys: ['↑', '↓'], description: 'Navigate projects (when sidebar focused)' },
        { keys: ['Enter'], description: 'Select project (when sidebar focused)' },
        { keys: ['Delete'], description: 'Delete project (when hovering)' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-milk-dark border border-milk-dark-light rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-milk-dark border-b border-milk-dark-light px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-milk-slate-light hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          {shortcuts.map((category) => (
            <div key={category.category}>
              <h3 className="text-lg font-semibold text-milk-light mb-4">{category.category}</h3>
              <div className="space-y-3">
                {category.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 px-4 bg-milk-dark-light/50 rounded-lg hover:bg-milk-dark-light transition-colors"
                  >
                    <span className="text-milk-lightest">{item.description}</span>
                    <div className="flex gap-1">
                      {item.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          {keyIndex > 0 && (
                            <span className="text-milk-slate-light mx-1">+</span>
                          )}
                          <kbd className="px-2.5 py-1.5 text-sm font-mono bg-milk-darkest border border-milk-slate/30 rounded-md text-milk-lightest shadow-sm">
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-milk-dark border-t border-milk-dark-light px-6 py-4">
          <p className="text-sm text-milk-slate-light text-center">
            Press <kbd className="px-2 py-1 text-xs font-mono bg-milk-darkest border border-milk-slate/30 rounded text-milk-lightest">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
