import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { toast } from 'react-toastify';
import { Project } from '../../../types';

interface ProjectSettingsModalProps {
  onClose: () => void;
  onSave: (updates: Partial<Project>) => void;
  project: Project;
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ onClose, onSave, project }) => {
  const [apiKey, setApiKey] = useState(project.apiKey || '');

  useEffect(() => {
    setApiKey(project.apiKey || '');
  }, [project]);

  const handleSave = () => {
    onSave({
      apiKey: apiKey.trim() || undefined,
    });
    onClose();
    toast.success('Project settings saved!');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setApiKey(text);
      toast.success('Pasted from clipboard!');
    } catch (error) {
      console.error('Failed to paste:', error);
      toast.error('Failed to paste from clipboard. Please grant clipboard permissions.');
    }
  };

  return (
    <Modal onClose={onClose} title={`Project Settings: ${project.name}`}>
      <div className="space-y-6">
        <div>
          <label htmlFor="projectApiKey" className="block text-sm font-medium text-milk-light mb-2">
            Project-Specific API Key
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              id="projectApiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 bg-milk-dark-light border border-milk-dark-light rounded-md px-3 py-2 text-white placeholder-milk-slate-light focus:outline-none focus:ring-2 focus:ring-milk-slate"
              placeholder="Leave empty to use global API key"
            />
            <button
              type="button"
              onClick={handlePaste}
              className="px-4 py-2 bg-milk-slate/20 text-milk-slate hover:bg-milk-slate/30 rounded-md transition-colors whitespace-nowrap"
              title="Paste from clipboard"
            >
              📋 Paste
            </button>
          </div>
          <p className="text-xs text-milk-slate-light mt-1">
            Optional: Use a different API key for this project. Falls back to global settings if empty.
          </p>
        </div>

        <div className="bg-milk-dark-light/30 border border-milk-dark-light rounded-md p-4">
          <h4 className="text-sm font-semibold text-milk-light mb-2">ℹ️ How Per-Project API Keys Work</h4>
          <ul className="text-xs text-milk-slate-light space-y-1">
            <li>• <strong>If set:</strong> This project uses its own API key.</li>
            <li>• <strong>If empty:</strong> Falls back to the global API key from Settings (Cmd/Ctrl+,).</li>
            <li>• <strong>Use case:</strong> Test experimental features or use different billing accounts per project.</li>
          </ul>
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

export default ProjectSettingsModal;
