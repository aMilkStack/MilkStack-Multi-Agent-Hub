import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';
import Modal from './Modal';
import { processCodebase } from '../../utils/codebaseProcessor';
import { fetchGitHubRepository } from '../../services/githubService';
import JSZip from 'jszip';

interface NewProjectModalProps {
  onClose: () => void;
  onCreateProject: (name: string, codebaseContext: string, initialMessage?: string, apiKey?: string) => void;
}

type ContextType = 'none' | 'folder' | 'github' | 'zip' | 'paste';

const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose, onCreateProject }) => {
  const [apiKey, setApiKey] = useState('');
  const [projectName, setProjectName] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [contextType, setContextType] = useState<ContextType>('none');
  const [files, setFiles] = useState<File[]>([]);
  const [pastedCode, setPastedCode] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handlePasteApiKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setApiKey(text);
      toast.success('Pasted API key from clipboard!');
    } catch (error) {
      console.error('Failed to paste:', error);
      toast.error('Failed to paste from clipboard. Please grant clipboard permissions.');
    }
  };

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
      } else if (contextType === 'github' && githubUrl.trim()) {
        // Get GitHub token from global settings (localStorage)
        const token = localStorage.getItem('github_token') || undefined;
        codebaseContext = await fetchGitHubRepository(githubUrl.trim(), token);
      } else if (contextType === 'zip' && zipFile) {
        codebaseContext = await processZipFile(zipFile);
      }
      onCreateProject(projectName.trim(), codebaseContext, initialMessage.trim() || undefined, apiKey.trim() || undefined);
    } catch (error) {
        console.error("Error processing codebase:", error);
        toast.error(error instanceof Error ? error.message : 'Failed to process codebase');
        setIsProcessing(false);
        return;
    }

    setIsProcessing(false);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
        setFiles(Array.from(e.target.files));
    }
  };

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setZipFile(e.target.files[0]);
    }
  };

  const handleFolderClick = () => {
    fileInputRef.current?.click();
  };

  const handleZipClick = () => {
    zipInputRef.current?.click();
  };

  const processZipFile = async (file: File): Promise<string> => {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(file);
    const files: File[] = [];

    // Convert JSZip entries to File objects
    for (const [path, entry] of Object.entries(zipData.files)) {
      if (!entry.dir) {
        const blob = await entry.async('blob');
        const file = new File([blob], entry.name, { type: 'text/plain' });
        // Add webkitRelativePath for processCodebase
        Object.defineProperty(file, 'webkitRelativePath', {
          writable: false,
          value: path
        });
        files.push(file);
      }
    }

    return processCodebase(files);
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
            <label htmlFor="apiKey" className="block text-sm font-medium text-milk-light mb-2">
              Gemini API Key <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 bg-milk-dark-light border border-milk-dark-light rounded-md px-3 py-2 text-white placeholder-milk-slate-light focus:outline-none focus:ring-2 focus:ring-milk-slate"
                placeholder="Enter your Gemini API key"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={handlePasteApiKey}
                className="px-4 py-2 bg-milk-slate/20 text-milk-slate hover:bg-milk-slate/30 rounded-md transition-colors whitespace-nowrap"
                title="Paste from clipboard"
              >
                📋 Paste
              </button>
            </div>
            <p className="text-xs text-milk-slate-light mt-1">
              Get your API key from{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-milk-slate hover:text-white underline">
                Google AI Studio
              </a>
            </p>
          </div>

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
            />
          </div>

          <div>
            <label htmlFor="initialMessage" className="block text-sm font-medium text-milk-light mb-2">
              Initial Message (Optional)
            </label>
            <textarea
              id="initialMessage"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              className="w-full bg-milk-dark-light border border-milk-dark-light rounded-md px-3 py-2 text-white placeholder-milk-slate-light focus:outline-none focus:ring-2 focus:ring-milk-slate min-h-[80px]"
              placeholder="e.g., 'Build a todo app with React and TypeScript'"
            />
            <p className="text-xs text-milk-slate-light mt-1">
              Start the conversation with a task or question for the agents
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-milk-light mb-2">
              Add Codebase Context (Optional)
            </label>
            <div className="grid grid-cols-5 gap-2 p-1 bg-milk-darkest/50 rounded-lg">
                <TabButton type="none" label="From Scratch" />
                <TabButton type="github" label="GitHub" />
                <TabButton type="folder" label="Folder" />
                <TabButton type="zip" label="ZIP" />
                <TabButton type="paste" label="Paste" />
            </div>
            
            <div className="mt-4 p-4 bg-milk-dark-light/50 rounded-lg min-h-[150px]">
                {contextType === 'none' && <p className="text-milk-slate-light text-center py-10">Start a new project without any codebase context.</p>}

                {contextType === 'github' && (
                    <div className="space-y-3">
                        <input
                            type="text"
                            value={githubUrl}
                            onChange={(e) => setGithubUrl(e.target.value)}
                            className="w-full bg-milk-darkest border border-milk-dark-light rounded-md px-3 py-2 text-white placeholder-milk-slate-light focus:outline-none focus:ring-2 focus:ring-milk-slate"
                            placeholder="https://github.com/owner/repo"
                        />
                        <p className="text-xs text-milk-slate-light">
                            Enter a GitHub repository URL. For private repos, set your GitHub PAT in Settings.
                        </p>
                    </div>
                )}

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

                {contextType === 'zip' && (
                    <div>
                        <input
                            type="file"
                            accept=".zip"
                            ref={zipInputRef}
                            onChange={handleZipChange}
                            className="hidden"
                        />
                        <button type="button" onClick={handleZipClick} className="w-full text-center py-6 border-2 border-dashed border-milk-slate-light rounded-lg hover:bg-milk-dark-light hover:border-milk-slate transition-colors">
                            <p className="text-milk-light">
                                {zipFile ? zipFile.name : 'Click to select a ZIP file'}
                            </p>
                            {zipFile && <p className="text-xs text-milk-slate-light mt-1">{(zipFile.size / 1024 / 1024).toFixed(2)} MB</p>}
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