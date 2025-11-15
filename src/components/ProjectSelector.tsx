import React from 'react';
import { Project } from '../../types';

interface ProjectSelectorProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onExportProjects?: () => void;
  onImportProjects?: (file: File) => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
  onExportProjects,
  onImportProjects,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold text-milk-light mb-4">Projects</h2>
      <div className="space-y-2">
        {projects.map(project => {
          const isActive = project.id === activeProjectId;
          return (
            <div
              key={project.id}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                isActive
                  ? 'bg-milk-slate/20 border border-milk-slate'
                  : 'bg-milk-dark-light/50 border border-transparent hover:border-milk-slate-light'
              }`}
              onClick={() => onSelectProject(project.id)}
            >
              <p className={`font-semibold ${isActive ? 'text-white' : 'text-milk-lightest'}`}>{project.name}</p>
              <p className={`text-xs ${isActive ? 'text-milk-light' : 'text-milk-slate-light'}`}>
                {project.messages.length} messages
              </p>
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
          <div className="flex gap-2">
            <button
              onClick={onExportProjects}
              disabled={projects.length === 0}
              className="flex-1 text-center py-2 text-xs text-milk-slate-light hover:text-white hover:bg-milk-dark-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export all projects to JSON"
            >
              Export
            </button>
            <button
              onClick={handleImportClick}
              className="flex-1 text-center py-2 text-xs text-milk-slate-light hover:text-white hover:bg-milk-dark-light rounded-lg transition-colors"
              title="Import projects from JSON"
            >
              Import
            </button>
          </div>
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