import React from 'react';
import ProjectSelector from './ProjectSelector';
import AgentList from './AgentList';
import SettingsButton from './SettingsButton';
import { Project } from '../../types';

interface SidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProjectClick: () => void;
  onSettingsClick: () => void;
  activeAgentId: string | null;
  onExportProjects?: () => void;
  onImportProjects?: (file: File) => void;
  onExportChat?: () => void;
  onRenameProject?: (id: string, newName: string) => void;
  onDeleteProject?: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProjectClick,
  onSettingsClick,
  activeAgentId,
  onExportProjects,
  onImportProjects,
  onExportChat,
  onRenameProject,
  onDeleteProject,
}) => {
  return (
    <aside className="w-80 flex-shrink-0 bg-milk-dark border-r border-milk-dark-light flex flex-col">
      <header className="py-4 px-6 border-b border-milk-dark-light flex-shrink-0 flex items-center justify-center">
        <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwMCIgdmlld0JveD0iMCAwIDEzMCAxNjMiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHBhdGggZD0ibTY1IDAgMTggOS45djMwbC0xOC05Ljl6IiBmaWxsPSIjYjRjYWM2Ii8+CiAgPHBhdGggZD0ibTY1IDBsLTE4IDkuOXYzMGwxOC05Ljl6IiBmaWxsPSIjZTFmNGZmIi8+CiAgPHBhdGggZD0ibTY1IDIwdi0yMGwtMTggOS45djExLjV6IiBmaWxsPSIjZTFmNGZmIi8+CiAgPHBhdGggZD0ibTEzMCA1OS45LTY1IDM1di0yMGw2NS0zNnoiIGZpbGw9IiNiNGNhYzYiLz4KICA8cGF0aCBkPSJtMCA1OS45IDY1IDM1di0yMGwtNjUtMzV6IiBmaWxsPSIjZTFmNGZmIi8+CiAgPHBhdGggZD0ibTEzMCA1OS45djQ1bC02NSA0OHYtNDV6IiBmaWxsPSIjMmY2NDg3Ii8+CiAgPHBhdGggZD0ibTAgNTkuOXY0NWw2NSA0OHYtNDV6IiBmaWxsPSIjNjhhNGJmIi8+CiAgPHBhdGggZD0ibTEzMCAxMDQuOXYyMGwtNjUgMTh2LTIweiIgZmlsbD0iIzFkNDk2OCIvPgogIDxwYXRoIGQ9Im0wIDEwNC45djIwbDY1IDE4di0yMHoiIGZpbGw9IiMyZjY0ODciLz4KICA8cGF0aCBkPSJtNjUgMTYyLjg4LTY1LTE4djE3LjEybDY1IDE4eiIgZmlsbD0iIzJmNjQ4NyIvPgogIDxwYXRoIGQ9Im02NSAxNjIuODggNjUtMTggMCAxNy4xMi02NSAxOHoiIGZpbGw9IiMxZDQ5NjgiLz4KICA8cGF0aCBkPSJtNjUgMTUuMDctLjM3LS4xNy0xMS4yMyA2LjE1YTEuNSAxLjUgMCAwIDAtLjc1IDEuM3Y0LjJhMS41IDEuNSAwIDAgMCAuNzYgMS4zbDExLjIgNi4yMWMuNDYuMjYuOTggLjI2IDEuNDQgMGwxMS4yMy02LjIxYTEuNSAxLjUgMCAwIDAgLjc2LTEuM3YtNC4yYTEuNSAxLjUgMCAwIDAtLjc1EtMS4zbC0xMS4yMy02LjE1LS4zNy4xN2ExLjQ2IDEuNDYgMCAwIDEtMS40NCAweiIgZmlsbD0iIzJmNjQ4NyIvPgo8L3N2Zz4K" alt="MilkStack Logo" className="h-10 w-auto" />
      </header>
      
      <ProjectSelector
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={onSelectProject}
        onNewProject={onNewProjectClick}
        onExportProjects={onExportProjects}
        onImportProjects={onImportProjects}
        onExportChat={onExportChat}
        onRenameProject={onRenameProject}
        onDeleteProject={onDeleteProject}
      />

      <AgentList activeAgentId={activeAgentId} />
      
      <SettingsButton onClick={onSettingsClick} />
    </aside>
  );
};

export default Sidebar;