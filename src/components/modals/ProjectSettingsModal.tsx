import React from 'react';
import Modal from './Modal';
import { toast } from 'react-toastify';
import { Project } from '../../types';

interface ProjectSettingsModalProps {
  onClose: () => void;
  onSave: (updates: Partial<Project>) => void;
  project: Project;
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ onClose, onSave, project }) => {
  const handleSave = () => {
    // No API key settings to save - all keys come from .env
    onSave({});
    onClose();
    toast.success('Project settings saved!');
  };

  return (
    <Modal onClose={onClose} title={`Project Settings: ${project.name}`}>
      <div className="space-y-6">
        <div className="bg-milk-dark-light/30 border border-milk-dark-light rounded-md p-4">
          <h4 className="text-sm font-semibold text-milk-light mb-2">🔑 API Keys</h4>
          <p className="text-xs text-milk-slate-light">
            API keys are configured via environment variables in your <code className="bg-milk-dark px-1 py-0.5 rounded">.env</code> file. All projects use the same API keys from environment variables.
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

export default ProjectSettingsModal;
