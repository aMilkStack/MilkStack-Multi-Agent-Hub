import React, { useState, useRef } from 'react';
import * as JSZip from 'jszip';
import { Project } from './types';
import { fetchRepoAsZip, parseGitHubUrl } from './githubService';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (project: Omit<Project, 'id' | 'messages'>) => void;
}

// A simple check for binary content to avoid including it in the context
const isBinary = (str: string) => /[\x00-\x08\x0E-\x1F]/.test(str);

// Common files/patterns to ignore during upload
const ignorePatterns = ['.git/', '__MACOSX', '.DS_Store', 'node_modules/', 'dist/', 'build/'];

const processZipFile = async (file: Blob): Promise<{ context: string, displayName: string }> => {
    // FIX: Corrected static method call. `loadAsync` is a static method on `JSZip`, not on `JSZip.default`.
    const zip = await JSZip.loadAsync(file);
    const fileContents: string[] = [];
    let filePaths: string[] = [];

    const filePromises = Object.keys(zip.files).map(async (relativePath) => {
        const zipEntry = zip.files[relativePath];
        if (!zipEntry.dir && !ignorePatterns.some(p => relativePath.includes(p))) {
            try {
                const fileContent = await zipEntry.async('string');
                if (fileContent.length < 100000 && !isBinary(fileContent)) {
                    filePaths.push(`- /${relativePath}`);
                    fileContents.push(`--- START OF FILE: /${relativePath} ---\n${fileContent}\n--- END OF FILE: /${relativePath} ---`);
                }
            } catch (e) {
                console.warn(`Could not read file ${relativePath} as text.`);
            }
        }
    });

    await Promise.all(filePromises);

    if (filePaths.length === 0) {
        throw new Error("The zip file was empty or contained no readable text files.");
    }

    filePaths.sort();
    const context = `File Tree:\n${filePaths.join('\n')}\n\n${fileContents.join('\n\n')}`;
    const displayName = `${(file as File).name || 'repository.zip'} (${filePaths.length} files)`;
    return { context, displayName };
};

const processFileList = async (files: FileList): Promise<{ context: string, displayName: string }> => {
    const fileContents: string[] = [];
    let filePaths: string[] = [];

    const filePromises = Array.from(files).map(async (file) => {
        const relativePath = file.webkitRelativePath;
        if (!relativePath || ignorePatterns.some(p => relativePath.includes(p))) {
            return;
        }
        try {
            const fileContent = await file.text();
            if (fileContent.length < 100000 && !isBinary(fileContent)) {
                filePaths.push(`- /${relativePath}`);
                fileContents.push(`--- START OF FILE: /${relativePath} ---\n${fileContent}\n--- END OF FILE: /${relativePath} ---`);
            }
        } catch (e) {
            console.warn(`Could not read file ${relativePath} as text.`);
        }
    });

    await Promise.all(filePromises);

    if (filePaths.length === 0) {
        throw new Error("The selected folder was empty or contained no readable text files.");
    }
    
    filePaths.sort();
    const context = `File Tree:\n${filePaths.join('\n')}\n\n${fileContents.join('\n\n')}`;
    const firstFile = Array.from(files).find(f => f.webkitRelativePath && !ignorePatterns.some(p => f.webkitRelativePath.includes(p)));
    const rootDir = firstFile ? firstFile.webkitRelativePath.split('/')[0] : "folder";
    const displayName = `${rootDir} (${filePaths.length} files)`;
    return { context, displayName };
};


const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [codebaseContext, setCodebaseContext] = useState<string | null>(null);
  
  const [statusMessage, setStatusMessage] = useState<string | null>('No codebase attached.');
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputMode, setInputMode] = useState<'form' | 'github'>('form');
  const [githubUrl, setGithubUrl] = useState('');

  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
      setTitle('');
      setDescription('');
      setCodebaseContext(null);
      setStatusMessage('No codebase attached.');
      setIsProcessing(false);
      setInputMode('form');
      setGithubUrl('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  const handleSave = () => {
    if (!title.trim()) {
      alert("Project title is required.");
      return;
    }
    onSave({ title, description, codebaseContext });
    handleClose();
  };

  const handleFileUpload = async (files: FileList | null, isDirectory: boolean) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);

    try {
        let result: { context: string, displayName: string };
        if (isDirectory) {
            setStatusMessage(`Processing folder...`);
            result = await processFileList(files);
        } else { // It's a zip file
            setStatusMessage(`Processing ${files[0].name}...`);
            result = await processZipFile(files[0]);
        }
        setCodebaseContext(result.context);
        setStatusMessage(`Attached: ${result.displayName}`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        setStatusMessage(`Error: ${errorMessage}`);
        setCodebaseContext(null);
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleGitHubConnect = async () => {
    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed) {
        setStatusMessage('Error: Invalid GitHub URL.');
        return;
    }

    setIsProcessing(true);
    setStatusMessage(`Fetching ${parsed.repo}...`);

    try {
        const repoBlob = await fetchRepoAsZip(parsed.owner, parsed.repo);
        setStatusMessage(`Processing ${parsed.repo}...`);
        const result = await processZipFile(repoBlob);
        
        setCodebaseContext(result.context);
        setStatusMessage(`Attached: ${result.displayName}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        setStatusMessage(`Error: ${errorMessage}`);
        setCodebaseContext(null);
    } finally {
        setIsProcessing(false);
        setInputMode('form');
        setGithubUrl('');
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" onClick={handleClose}>
      <div className="bg-brand-sidebar rounded-lg shadow-xl p-8 w-full max-w-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6 text-brand-text">Create New Project</h2>
        
        {inputMode === 'form' ? (
          <>
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-brand-text-light mb-1">Project Title</label>
                <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-brand-bg-dark border border-white/10 rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-secondary focus:outline-none" />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-brand-text-light mb-1">Description</label>
                <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full bg-brand-bg-dark border border-white/10 rounded-md p-2 text-brand-text resize-none focus:ring-2 focus:ring-brand-secondary focus:outline-none"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-light mb-2">Attach Codebase (Optional)</label>
                 <input type="file" accept=".zip" ref={zipInputRef} onChange={(e) => handleFileUpload(e.target.files, false)} className="hidden" />
                 <input type="file" {...{ webkitdirectory: "", directory: "" }} multiple ref={folderInputRef} onChange={(e) => handleFileUpload(e.target.files, true)} className="hidden" />
                <div className="flex space-x-2">
                    <button onClick={() => setInputMode('github')} disabled={isProcessing} className="flex-1 text-center px-4 py-2 text-sm bg-brand-bg-light rounded-md hover:bg-opacity-80 disabled:opacity-50">Connect GitHub Repo</button>
                    <button onClick={() => folderInputRef.current?.click()} disabled={isProcessing} className="flex-1 text-center px-4 py-2 text-sm bg-brand-bg-light rounded-md hover:bg-opacity-80 disabled:opacity-50">Upload Folder</button>
                    <button onClick={() => zipInputRef.current?.click()} disabled={isProcessing} className="flex-1 text-center px-4 py-2 text-sm bg-brand-bg-light rounded-md hover:bg-opacity-80 disabled:opacity-50">Upload .zip File</button>
                </div>
                <p className={`text-xs mt-2 ${statusMessage?.startsWith('Error') ? 'text-red-400' : 'text-brand-text-light'}`}>{statusMessage}</p>
              </div>
            </div>

            <div className="mt-8 flex justify-end space-x-3">
              <button onClick={handleClose} className="px-4 py-2 rounded-md text-sm font-medium bg-brand-bg-light hover:bg-opacity-80 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={!title.trim() || isProcessing} className="px-4 py-2 rounded-md text-sm font-medium bg-brand-secondary text-brand-sidebar hover:bg-opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Create Project</button>
            </div>
          </>
        ) : (
             <div>
                <label htmlFor="github-url" className="block text-sm font-medium text-brand-text-light mb-1">GitHub Repository URL</label>
                <input type="text" id="github-url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/owner/repo" autoFocus className="w-full bg-brand-bg-dark border border-white/10 rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-secondary focus:outline-none" />
                 <div className="mt-4 flex justify-end space-x-3">
                    <button onClick={() => setInputMode('form')} className="px-4 py-2 rounded-md text-sm font-medium bg-brand-bg-light hover:bg-opacity-80 transition-colors">Back</button>
                    <button onClick={handleGitHubConnect} disabled={!githubUrl.trim() || isProcessing} className="px-4 py-2 rounded-md text-sm font-medium bg-brand-secondary text-brand-sidebar hover:bg-opacity-90 transition-colors disabled:opacity-50">Connect & Attach</button>
                 </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default NewProjectModal;