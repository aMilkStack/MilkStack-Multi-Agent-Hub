import React from 'react';
import { Project } from '../../types';

interface ProjectSelectorProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, activeProjectId, onSelectProject, onNewProject }) => {
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
      </div>
    </div>
  );
};

export default ProjectSelector;