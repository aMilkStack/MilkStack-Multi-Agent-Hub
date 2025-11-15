import React, { useState, useRef } from 'react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  onAddContext: (files: File[]) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, onAddContext }) => {
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  const handleAttachClick = () => {
    fileInputRef.current?.click();
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
             onClick={handleAttachClick}
             className="p-2 text-milk-slate-light hover:text-white hover:bg-milk-dark-light rounded-md transition-colors" title="Attach Folder">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
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
};

export default MessageInput;