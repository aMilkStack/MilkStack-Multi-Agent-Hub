import React from 'react';
import { Agent, Project } from '../types';
import AgentCard from './AgentCard';
import ProjectSelector from './ProjectSelector';

interface SidebarProps {
  agents: Agent[];
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateNewProject: () => void;
  onSettingsClick: () => void;
}

const ActivityIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const UsersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197M15 11a4 4 0 110-5.292" />
    </svg>
);

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const Sidebar: React.FC<SidebarProps> = ({ agents, projects, activeProjectId, onSelectProject, onCreateNewProject, onSettingsClick }) => {

  return (
    <aside className="w-1/4 max-w-sm h-full bg-brand-sidebar p-6 flex flex-col border-r border-brand-light/10 overflow-y-auto">
      <ProjectSelector 
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={onSelectProject}
        onCreateNewProject={onCreateNewProject}
      />

      <div className="flex items-center text-brand-text-light my-6 px-2">
        <ActivityIcon />
        <span>{agents.length} staff active</span>
      </div>

      <div className="flex items-center text-brand-text font-semibold mb-4 px-2">
        <UsersIcon />
        <span>Active Staff</span>
      </div>

      <div className="space-y-2 flex-grow">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
      
      <div className="mt-auto pt-4 border-t border-brand-light/10">
        <button onClick={onSettingsClick} className="w-full flex items-center justify-center py-2 px-4 rounded-lg text-sm text-brand-text-light hover:bg-brand-bg-dark hover:text-brand-text transition-colors">
            <SettingsIcon />
            <span className="ml-2">Settings</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
