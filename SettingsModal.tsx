
import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [githubPat, setGithubPat] = useState('');
  const [globalRulesText, setGlobalRulesText] = useState('');

  useEffect(() => {
    if (isOpen) {
      const storedPat = localStorage.getItem('github_pat') || '';
      setGithubPat(storedPat);

      const storedRules = localStorage.getItem('global_rules');
      if (storedRules) {
        try {
          // For backward compatibility, try parsing as an array
          const parsedRules = JSON.parse(storedRules);
          if (Array.isArray(parsedRules)) {
            setGlobalRulesText(parsedRules.join('\n'));
          } else {
            // If it's not an array but some other JSON, treat it as a string
            setGlobalRulesText(String(storedRules));
          }
        } catch (e) {
          // If JSON.parse fails, it's likely already a raw string from the new format
          setGlobalRulesText(storedRules);
        }
      } else {
        setGlobalRulesText('');
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    try {
      localStorage.setItem('github_pat', githubPat);
      localStorage.setItem('global_rules', globalRulesText);
      onClose();
    } catch (e) {
      console.error("Could not save to localStorage.");
      alert("Error: Could not save settings. Your browser might be in private mode or has storage disabled.");
    }
  };


  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity" onClick={onClose}>
      <div className="bg-brand-sidebar rounded-lg shadow-xl p-8 w-full max-w-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6 text-brand-text">Settings</h2>
        
        <div className="space-y-6">
          <div>
            <label htmlFor="github-pat" className="block text-sm font-medium text-brand-text-light mb-1">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              id="github-pat"
              value={githubPat}
              onChange={(e) => setGithubPat(e.target.value)}
              placeholder="ghp_..."
              className="w-full bg-brand-bg-dark border border-white/10 rounded-md p-2 text-brand-text focus:ring-2 focus:ring-brand-secondary focus:outline-none"
            />
            <p className="text-xs text-brand-text-light mt-2">
              Required for accessing private repositories. Your token is stored securely in your browser's local storage.
              <a href="https://github.com/settings/tokens/new?scopes=repo" target="_blank" rel="noopener noreferrer" className="text-brand-secondary/80 hover:underline ml-1">
                Create a new token here.
              </a>
            </p>
          </div>
          
          <div>
            <label htmlFor="global-rules" className="block text-sm font-medium text-brand-text-light mb-2">
                Global Rules
            </label>
            <textarea
                id="global-rules"
                value={globalRulesText}
                onChange={(e) => setGlobalRulesText(e.target.value)}
                placeholder="Enter your global rules here. Markdown is supported."
                rows={8}
                className="w-full bg-brand-bg-dark border border-white/10 rounded-md p-2 text-brand-text resize-y focus:ring-2 focus:ring-brand-secondary focus:outline-none"
            />
             <p className="text-xs text-brand-text-light mt-2">
                These rules (e.g., a markdown list) are added to the instructions for all specialist agents.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-medium bg-brand-bg-light hover:bg-opacity-80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md text-sm font-medium bg-brand-secondary text-brand-sidebar hover:bg-opacity-90 transition-colors"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;