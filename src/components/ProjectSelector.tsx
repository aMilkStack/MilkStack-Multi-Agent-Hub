import React, { useState } from 'react';
import { Project } from '../../types';

interface ProjectSelectorProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onExportProjects?: () => void;
  onImportProjects?: (file: File) => void;
  onExportChat?: () => void;
  onRenameProject?: (id: string, newName: string) => void;
  onDeleteProject?: (id: string) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
  onExportProjects,
  onImportProjects,
  onExportChat,
  onRenameProject,
  onDeleteProject,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showActions, setShowActions] = useState<string | null>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportProjects) {
      onImportProjects(file);
      // Reset the input
      e.target.value = '';
    }
  };

  const startEdit = (project: Project) => {
    setEditingId(project.id);
    setEditName(project.name);
  };

  const saveEdit = (id: string) => {
    if (editName.trim() && onRenameProject) {
      onRenameProject(id, editName.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (id: string) => {
    if (onDeleteProject) {
      onDeleteProject(id);
    }
    setShowActions(null);
  };
  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold text-milk-light mb-4">Projects</h2>
      <div className="space-y-2">
        {projects.map(project => {
          const isActive = project.id === activeProjectId;
          const isEditing = editingId === project.id;
          const showActionsMenu = showActions === project.id;

          return (
            <div
              key={project.id}
              className={`p-3 rounded-lg transition-all relative group ${
                isActive
                  ? 'bg-milk-slate/20 border border-milk-slate'
                  : 'bg-milk-dark-light/50 border border-transparent hover:border-milk-slate-light'
              }`}
              onMouseEnter={() => setShowActions(project.id)}
              onMouseLeave={() => !isEditing && setShowActions(null)}
            >
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(project.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="flex-1 bg-milk-darkest border border-milk-slate rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-milk-slate"
                    autoFocus
                  />
                  <button
                    onClick={() => saveEdit(project.id)}
                    className="text-green-500 hover:text-green-400 text-xs"
                    title="Save"
                  >
                    ✓
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="text-red-500 hover:text-red-400 text-xs"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="cursor-pointer"
                    onClick={() => onSelectProject(project.id)}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`font-semibold ${isActive ? 'text-white' : 'text-milk-lightest'}`}>
                        {project.name}
                      </p>
                      {showActionsMenu && (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(project);
                            }}
                            className="p-1 hover:bg-milk-slate/20 rounded text-milk-slate-light hover:text-white transition-colors"
                            title="Rename project"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(project.id);
                            }}
                            className="p-1 hover:bg-red-500/20 rounded text-milk-slate-light hover:text-red-400 transition-colors"
                            title="Delete project"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <p className={`text-xs ${isActive ? 'text-milk-light' : 'text-milk-slate-light'}`}>
                      {project.messages.length} messages
                    </p>
                  </div>
                </>
              )}
            </div>
          );
        })}
        <button
          onClick={onNewProject}
          className="w-full text-center py-2 text-sm text-milk-slate-light hover:text-white hover:bg-milk-dark-light rounded-lg transition-colors mt-4"
        >
          + New Project
        </button>

        {/* Export/Import Section */}
        <div className="mt-6 pt-4 border-t border-milk-dark-light">
          <h3 className="text-sm font-semibold text-milk-slate-light mb-2">Backup</h3>
          <div className="flex gap-2 mb-2">
            <button
              onClick={onExportProjects}
              disabled={projects.length === 0}
              className="flex-1 text-center py-2 text-xs text-milk-slate-light hover:text-white hover:bg-milk-dark-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export all projects to JSON"
            >
              Export All
            </button>
            <button
              onClick={handleImportClick}
              className="flex-1 text-center py-2 text-xs text-milk-slate-light hover:text-white hover:bg-milk-dark-light rounded-lg transition-colors"
              title="Import projects from JSON"
            >
              Import
            </button>
          </div>
          <button
            onClick={onExportChat}
            disabled={!activeProjectId}
            className="w-full text-center py-2 text-xs text-milk-slate-light hover:text-white hover:bg-milk-dark-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export current conversation as Markdown"
          >
            📤 Export Chat
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default ProjectSelector;