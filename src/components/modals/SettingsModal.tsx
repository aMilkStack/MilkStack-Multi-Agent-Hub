import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { toast } from 'react-toastify';
import { Settings, GeminiModel } from '../../../types';

interface SettingsModalProps {
  onClose: () => void;
  onSave: (settings: Settings) => void;
  initialSettings: Settings;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onSave, initialSettings }) => {
  const [settings, setSettings] = useState<Settings>(initialSettings);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  const handleSave = () => {
    onSave(settings);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

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
        <div>
          <label htmlFor="githubPat" className="block text-sm font-medium text-milk-light mb-2">
            GitHub PAT (Optional)
          </label>
          <input
            type="password"
            id="githubPat"
            name="githubPat"
            value={settings.githubPat}
            onChange={handleChange}
            className="w-full bg-milk-dark-light border border-milk-dark-light rounded-md px-3 py-2 text-white placeholder-milk-slate-light focus:outline-none focus:ring-2 focus:ring-milk-slate"
            placeholder="Enter your GitHub Personal Access Token"
          />
          <p className="text-xs text-milk-slate-light mt-1">
            Used for accessing private GitHub repositories and creating pull requests
          </p>
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