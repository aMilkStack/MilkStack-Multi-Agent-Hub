import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  title: string;
}

const Modal: React.FC<ModalProps> = ({ onClose, children, title }) => {
  const modalRoot = document.getElementById('modal-root');
  const modalRef = useRef<HTMLDivElement>(null);

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

    // Use setTimeout to avoid closing modal immediately on open
    const timerId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
    }, 0);


    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  if (!modalRoot) {
    return null;
  }

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-milk-darkest/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div ref={modalRef} className="bg-milk-dark rounded-lg shadow-2xl border border-milk-dark-light w-full max-w-lg mx-4">
        <header className="flex justify-between items-center p-4 border-b border-milk-dark-light">
          <h2 className="text-xl font-bold text-milk-lightest">{title}</h2>
          <button onClick={onClose} className="text-milk-slate-light hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    modalRoot
  );
};

export default Modal;