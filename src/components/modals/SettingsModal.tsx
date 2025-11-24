import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { toast } from 'react-toastify';
import { Settings, GeminiModel } from '../../../types';
import { getRustyConfig, setRustyRepoConfig } from '../../../src/config/rustyConfig';

interface SettingsModalProps {
  onClose: () => void;
  onSave: (settings: Settings) => void;
  initialSettings: Settings;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onSave, initialSettings }) => {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [rustyRepo, setRustyRepo] = useState(() => {
    const config = getRustyConfig();
    return {
      owner: config.repo.owner,
      name: config.repo.name,
      branch: config.repo.branch,
    };
  });

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const handleSave = () => {
    // Save regular settings
    onSave(settings);
    // Save Rusty config
    setRustyRepoConfig(rustyRepo.owner, rustyRepo.name, rustyRepo.branch);
    toast.success('Settings saved!');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  // handlePaste removed - no longer needed since API keys are in .env file

  const handleClearCache = async () => {
    if (window.confirm('Are you sure you want to clear all cached data? This will reload the page.')) {
      try {
        // Clear IndexedDB
        const databases = await window.indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            window.indexedDB.deleteDatabase(db.name);
          }
        }
        // Clear localStorage
        localStorage.clear();
        // Clear sessionStorage
        sessionStorage.clear();
        toast.success('Cache cleared! Reloading...');
        // Reload the page after a short delay
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        console.error('Error clearing cache:', error);
        toast.error('Failed to clear cache');
      }
    }
  };

  return (
    <Modal onClose={onClose} title="Settings">
      <div className="space-y-6">
        <div className="bg-milk-dark-light/30 border border-milk-dark-light rounded-md p-4">
          <h4 className="text-sm font-semibold text-milk-light mb-2">🔑 API Keys</h4>
          <p className="text-xs text-milk-slate-light">
            API keys are now configured via environment variables. Set <code className="bg-milk-dark px-1 py-0.5 rounded">GEMINI_API_KEY</code> and <code className="bg-milk-dark px-1 py-0.5 rounded">VITE_ANTHROPIC_API_KEY</code> in your <code className="bg-milk-dark px-1 py-0.5 rounded">.env</code> file. See <code className="bg-milk-dark px-1 py-0.5 rounded">.env.example</code> for details.
          </p>
        </div>

        <div>
          <label htmlFor="githubPat" className="block text-sm font-medium text-milk-light mb-2">
            GitHub PAT (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              id="githubPat"
              name="githubPat"
              value={settings.githubPat}
              onChange={handleChange}
              className="flex-1 bg-milk-dark-light border border-milk-dark-light rounded-md px-3 py-2 text-white placeholder-milk-slate-light focus:outline-none focus:ring-2 focus:ring-milk-slate"
              placeholder="Enter your GitHub Personal Access Token"
            />
            <button
              type="button"
              onClick={() => handlePaste('githubPat')}
              className="px-4 py-2 bg-milk-slate/20 text-milk-slate hover:bg-milk-slate/30 rounded-md transition-colors whitespace-nowrap"
              title="Paste from clipboard"
            >
              📋 Paste
            </button>
          </div>
          <p className="text-xs text-milk-slate-light mt-1">
            Used for accessing private GitHub repositories and creating pull requests
          </p>
        </div>

        <div className="pt-6 border-t border-milk-dark-light">
          <h3 className="text-sm font-semibold text-milk-light mb-4">Rusty Configuration</h3>
          <p className="text-xs text-milk-slate-light mb-4">
            Configure which repository Rusty monitors. Changes require a page reload to take effect.
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="rustyOwner" className="block text-sm font-medium text-milk-light mb-2">
                Repository Owner
              </label>
              <input
                type="text"
                id="rustyOwner"
                value={rustyRepo.owner}
                onChange={(e) => setRustyRepo(prev => ({ ...prev, owner: e.target.value }))}
                className="w-full bg-milk-dark-light border border-milk-dark-light rounded-md px-3 py-2 text-white placeholder-milk-slate-light focus:outline-none focus:ring-2 focus:ring-milk-slate"
                placeholder="e.g., aMilkStack"
              />
            </div>
            <div>
              <label htmlFor="rustyName" className="block text-sm font-medium text-milk-light mb-2">
                Repository Name
              </label>
              <input
                type="text"
                id="rustyName"
                value={rustyRepo.name}
                onChange={(e) => setRustyRepo(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-milk-dark-light border border-milk-dark-light rounded-md px-3 py-2 text-white placeholder-milk-slate-light focus:outline-none focus:ring-2 focus:ring-milk-slate"
                placeholder="e.g., MilkStack-Multi-Agent-Hub"
              />
            </div>
            <div>
              <label htmlFor="rustyBranch" className="block text-sm font-medium text-milk-light mb-2">
                Branch
              </label>
              <input
                type="text"
                id="rustyBranch"
                value={rustyRepo.branch}
                onChange={(e) => setRustyRepo(prev => ({ ...prev, branch: e.target.value }))}
                className="w-full bg-milk-dark-light border border-milk-dark-light rounded-md px-3 py-2 text-white placeholder-milk-slate-light focus:outline-none focus:ring-2 focus:ring-milk-slate"
                placeholder="e.g., main"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-milk-dark-light">
          <h3 className="text-sm font-semibold text-milk-light mb-2">Developer Tools</h3>
          <button
            type="button"
            onClick={handleClearCache}
            className="w-full px-4 py-2 bg-red-500/10 text-red-400 rounded-md hover:bg-red-500/20 transition-colors border border-red-500/30"
          >
            🗑️ Clear All Cache & Data
          </button>
          <p className="text-xs text-milk-slate-light mt-2">
            This will clear all cached data (projects, settings, etc.) and reload the page. Use this if you encounter issues.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-8">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-milk-dark-light text-white rounded-md hover:bg-milk-slate/80 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-milk-slate text-white rounded-md hover:bg-milk-slate-dark transition-colors"
        >
          Save Settings
        </button>
      </div>
    </Modal>
  );
};

export default SettingsModal;