import React, { useState, useRef } from 'react';
import Modal from './Modal';
import { processCodebase } from '../../utils/codebaseProcessor';

interface NewProjectModalProps {
  onClose: () => void;
  onCreateProject: (name: string, codebaseContext: string) => void;
}

type ContextType = 'none' | 'folder' | 'paste';

const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose, onCreateProject }) => {
  const [projectName, setProjectName] = useState('');
  const [contextType, setContextType] = useState<ContextType>('none');
  const [files, setFiles] = useState<File[]>([]);
  const [pastedCode, setPastedCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    setIsProcessing(true);
    let codebaseContext = '';
    try {
      if (contextType === 'folder' && files.length > 0) {
        codebaseContext = await processCodebase(files);
      } else if (contextType === 'paste') {
        codebaseContext = pastedCode;
      }
      onCreateProject(projectName.trim(), codebaseContext);
    } catch (error) {
        console.error("Error processing codebase:", error);
        // You might want to show an error to the user here
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        setFiles(Array.from(e.target.files));
    }
  };
  
  const handleFolderClick = () => {
    fileInputRef.current?.click();
  };

  const TabButton: React.FC<{ type: ContextType; label: string }> = ({ type, label }) => (
    <button
      type="button"
      onClick={() => setContextType(type)}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${
        contextType === type
          ? 'bg-milk-slate text-white'
          : 'bg-milk-dark-light text-milk-light hover:bg-milk-slate/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Modal onClose={onClose} title="Create New Project">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-milk-light mb-2">
              Project Name
            </label>
            <input
              type="text"
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full bg-milk-dark-light border border-milk-dark-light rounded-md px-3 py-2 text-white placeholder-milk-slate-light focus:outline-none focus:ring-2 focus:ring-milk-slate"
              placeholder="e.g., 'My Awesome Project'"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-milk-light mb-2">
              Add Codebase Context (Optional)
            </label>
            <div className="flex space-x-2 p-1 bg-milk-darkest/50 rounded-lg">
                <TabButton type="none" label="From Scratch" />
                <TabButton type="folder" label="Upload Folder" />
                <TabButton type="paste" label="Paste Text" />
            </div>
            
            <div className="mt-4 p-4 bg-milk-dark-light/50 rounded-lg min-h-[150px]">
                {contextType === 'none' && <p className="text-milk-slate-light text-center py-10">Start a new project without any codebase context.</p>}
                {contextType === 'folder' && (
                    <div>
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
                        <button type="button" onClick={handleFolderClick} className="w-full text-center py-6 border-2 border-dashed border-milk-slate-light rounded-lg hover:bg-milk-dark-light hover:border-milk-slate transition-colors">
                            <p className="text-milk-light">
                                {files.length > 0 ? `${files.length} files selected` : 'Click to select a folder'}
                            </p>
                            {files.length > 0 && <p className="text-xs text-milk-slate-light mt-1">{files[0].webkitRelativePath.split('/')[0]}</p>}
                        </button>
                    </div>
                )}
                {contextType === 'paste' && (
                    <textarea 
                        value={pastedCode}
                        onChange={(e) => setPastedCode(e.target.value)}
                        className="w-full h-40 bg-milk-darkest border border-milk-dark-light rounded-md p-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-milk-slate"
                        placeholder="Paste your code or context here..."
                    />
                )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-milk-dark-light text-white rounded-md hover:bg-milk-slate/80 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-milk-slate text-white rounded-md hover:bg-milk-slate-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            disabled={!projectName.trim() || isProcessing}
          >
            {isProcessing ? (
                <>
                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
            ) : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default NewProjectModal;