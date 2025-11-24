import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { toast } from 'react-toastify';
import { Settings } from '../../types';
import { RUSTY_CONFIG } from '../../config/rustyConfig';

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
    toast.success('Settings saved!');
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
        {/* API Keys Information */}
        <div className="bg-milk-dark-light/30 border border-milk-dark-light rounded-md p-4">
          <h4 className="text-sm font-semibold text-milk-light mb-3">🔑 API Configuration</h4>
          <div className="space-y-2 text-xs text-milk-slate-light">
            <p>
              All API keys are configured via environment variables in your <code className="bg-milk-dark px-1.5 py-0.5 rounded text-milk-slate">.env</code> file:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="bg-milk-dark px-1.5 py-0.5 rounded text-milk-slate">GEMINI_API_KEY</code> - Multi-agent system</li>
              <li><code className="bg-milk-dark px-1.5 py-0.5 rounded text-milk-slate">VITE_ANTHROPIC_API_KEY</code> - Rusty/Claude agent</li>
              <li><code className="bg-milk-dark px-1.5 py-0.5 rounded text-milk-slate">VITE_GITHUB_TOKEN</code> - GitHub integration (optional)</li>
            </ul>
            <p className="mt-2">
              See <code className="bg-milk-dark px-1.5 py-0.5 rounded text-milk-slate">.env.example</code> for details.
            </p>
          </div>
        </div>

        {/* Rusty Information (Read-only) */}
        <div className="bg-milk-dark-light/30 border border-milk-dark-light rounded-md p-4">
          <h4 className="text-sm font-semibold text-milk-light mb-3">🔧 Rusty - Meta Code Guardian</h4>
          <div className="space-y-2 text-xs text-milk-slate-light">
            <p>Rusty is hardcoded to monitor the MilkStack Multi-Agent Hub:</p>
            <div className="font-mono text-xs bg-milk-dark px-3 py-2 rounded text-milk-slate mt-2">
              {RUSTY_CONFIG.repo.fullUrl}
            </div>
            <p className="mt-2">
              Branch: <span className="text-milk-slate font-mono">{RUSTY_CONFIG.repo.branch}</span>
            </p>
          </div>
        </div>

        {/* Developer Tools */}
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
