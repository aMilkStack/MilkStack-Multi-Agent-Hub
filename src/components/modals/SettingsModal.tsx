import React, { useState, useEffect } from 'react';
import Modal from './Modal';
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

  return (
    <Modal onClose={onClose} title="Settings">
      <div className="space-y-6">
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-milk-light mb-2">
            Gemini API Key <span className="text-red-400">*</span>
          </label>
          <input
            type="password"
            id="apiKey"
            name="apiKey"
            value={settings.apiKey}
            onChange={handleChange}
            className="w-full bg-milk-dark-light border border-milk-dark-light rounded-md px-3 py-2 text-white placeholder-milk-slate-light focus:outline-none focus:ring-2 focus:ring-milk-slate"
            placeholder="Enter your Gemini API key"
          />
          <p className="text-xs text-milk-slate-light mt-1">
            Get your API key from{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-milk-slate hover:text-white underline">
              Google AI Studio
            </a>
          </p>
        </div>
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
        </div>
        <div>
          <label htmlFor="model" className="block text-sm font-medium text-milk-light mb-2">
            Specialist Agent Model
          </label>
          <select
            id="model"
            name="model"
            value={settings.model}
            onChange={handleChange}
            className="w-full bg-milk-dark-light border border-milk-dark-light rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-milk-slate"
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Faster)</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro (Smarter)</option>
          </select>
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