import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'react-toastify';
import { enhanceUserMessage, shouldSuggestEnhancement } from '../services/messageEnhancementService';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onAddContext: (files: File[]) => void;
  apiKey?: string; // API key for message enhancement
}

export interface MessageInputHandle {
  focus: () => void;
}

const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(
  ({ onSendMessage, onAddContext, apiKey }, ref) => {
    const [message, setMessage] = useState('');
    const [isEnhancing, setIsEnhancing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus();
      },
    }));

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift) or Cmd/Ctrl+Enter
    if (e.key === 'Enter' && !e.shiftKey && !(e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setMessage(text);
      toast.success('Pasted from clipboard!');
    } catch (error) {
      console.error('Failed to paste:', error);
      toast.error('Failed to paste from clipboard. Please grant clipboard permissions.');
    }
  };

  const handleEnhanceMessage = async () => {
    if (!message.trim()) {
      toast.warning('Type a message first before enhancing');
      return;
    }

    if (!apiKey) {
      toast.error('API key required. Please set your API key in Settings.');
      return;
    }

    setIsEnhancing(true);
    try {
      toast.info('✨ Enhancing your message...');
      const enhanced = await enhanceUserMessage(message, apiKey);
      setMessage(enhanced);
      toast.success('✨ Message enhanced! Review and edit if needed.');
    } catch (error) {
      console.error('Enhancement error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to enhance message');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          onAddContext(Array.from(e.target.files));
          // Reset the input value to allow selecting the same folder again
          e.target.value = '';
      }
  };

  return (
    <footer className="p-4 border-t border-milk-dark-light bg-milk-dark/60 flex-shrink-0">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-milk-dark-light/80 rounded-lg p-4 pr-40 text-milk-lightest resize-none focus:outline-none focus:ring-2 focus:ring-milk-slate transition-shadow"
          placeholder="Type your message..."
          rows={3}
        />
        <div className="absolute bottom-3 right-3 flex items-center space-x-2">
           <input
             type="file"
             // @ts-ignore
             webkitdirectory="true"
             directory="true"
             multiple
             ref={fileInputRef}
             onChange={handleFileChange}
             className="hidden"
           />
           <button
             onClick={handlePaste}
             className="p-2 text-milk-slate-light hover:text-white hover:bg-milk-dark-light rounded-md transition-colors"
             title="Paste from clipboard"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
             </svg>
           </button>
           <button
             onClick={handleAttachClick}
             className="p-2 text-milk-slate-light hover:text-white hover:bg-milk-dark-light rounded-md transition-colors"
             title="Attach Folder"
           >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
           </button>
           <button
             onClick={handleEnhanceMessage}
             disabled={isEnhancing || !message.trim()}
             className={`p-2 rounded-md transition-all ${
               isEnhancing || !message.trim()
                 ? 'text-milk-slate-light/50 cursor-not-allowed'
                 : 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10'
             }`}
             title="Enhance Message (BHEMPE) - Transform your message into a detailed specification"
           >
             {isEnhancing ? (
               <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
             ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
               </svg>
             )}
           </button>
           <button
             onClick={handleSend}
             className="bg-milk-slate hover:bg-milk-slate-dark text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center"
             title="Send Message"
           >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
             <span className="ml-2">Send</span>
           </button>
        </div>
      </div>
    </footer>
  );
});

MessageInput.displayName = 'MessageInput';

export default MessageInput;