'use client';

import type { Project, Agent, Settings, ProjectType } from '@/lib/types';
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { ProjectSwitcher } from './project-switcher';
import { AgentList } from './agent-list';
import { SettingsDialog } from './settings-dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { NewProjectDialog } from './new-project-dialog';

interface AppSidebarProps {
  projects: Project[];
  activeProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  onNewProject: (name: string, type: ProjectType, githubUrl?: string) => void;
  onDeleteProject: (projectId: string) => void;
  agents: Agent[];
  onAgentsChange: (agents: Agent[]) => void;
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onExportProject: () => void;
  onImportProject: (file: File) => void;
}

export function AppSidebar({ 
  projects, 
  activeProjectId, 
  onProjectChange, 
  onNewProject, 
  onDeleteProject,
  agents,
  onAgentsChange,
  settings, 
  onSettingsChange,
  onExportProject,
  onImportProject
}: AppSidebarProps) {
  return (
    <Sidebar className="border-r" variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 100 100"
                fill="none"
                className="h-8 w-8"
              >
                <g clipPath="url(#clip0_105_2)">
                  <path
                    fill="#F2F4F8"
                    d="M89.3333 34.2222L89.3333 13.6667L49.9999 0L10.6666 13.6667V34.2222L49.9999 47.8889L89.3333 34.2222Z"
                  />
                  <path
                    fill="#C3CBD5"
                    d="M49.9999 47.8889L10.6666 34.2222V42.8889L49.9999 56.5556L89.3333 42.8889V34.2222L49.9999 47.8889Z"
                  />
                  <path
                    fill="#A6B1C1"
                    d="M49.9999 65.2222L10.6666 51.5555V60.2222L49.9999 73.8889L89.3333 60.2222V51.5555L49.9999 65.2222Z"
                  />
                  <path
                    fill="#8A96A8"
                    d="M49.9999 82.5555L10.6666 68.8889V77.5555L49.9999 91.2222L89.3333 77.5555V68.8889L49.9999 82.5555Z"
                  />

                  <path
                    fill="#3B5980"
                    d="M93.6667 80L93.6667 11.2222L50 100L50 91.2222L89.3333 77.5555V80L93.6667 80Z"
                  />
                  <path
                    fill="#3B5980"
                    d="M89.3333 13.6667V34.2222L49.9999 47.8889L49.9999 27.1111L89.3333 13.6667Z"
                  />
                  <path
                    fill="#3B5980"
                    d="M49.9999 56.5556L89.3333 42.8889V34.2222L49.9999 47.8889V56.5556Z"

                  />
                  <path
                    fill="#3B5980"
                    d="M49.9999 73.8889L89.3333 60.2222V51.5555L49.9999 65.2222V73.8889Z"
nd="M49.9999 91.2222L89.3333 77.5555V68.8889L49.9999 82.5555V91.2222Z"
                  />
                  <path
                    opacity="0.2"
                    fill="url(#paint0_linear_105_2)"
                    d="M50 27.1111L10.6667 13.6667L10.6667 80L50 100L93.6667 80V11.2222L50 27.1111Z"
                  />
                  <path
                    opacity="0.5"
                    fill="#F2F4F8"
                    d="M49.9999 20.3333C54.4832 20.3333 58.111 16.7055 58.111 12.2222C58.111 7.73891 54.4832 4.11108 49.9999 4.11108C45.5166 4.11108 41.8888 7.73891 41.8888 12.2222C41.8888 16.7055 45.5166 20.3333 49.9999 20.3333Z"
                  />
                  <path
                    fill="#8A96A8"
                    d="M52.6667 10.4444C52.1778 12.4222 50.3334 13.8889 48.2223 13.8889C46.1112 13.8889 44.2667 12.4222 43.7778 10.4444H39.3334V8.66665H43.7778C44.2667 6.68887 46.1112 5.2222 48.2223 5.2222C50.3334 5.2222 52.1778 6.68887 52.6667 8.66665H57.1112V10.4444H52.6667Z"
                  />
                </g>
                <defs>
                  <linearGradient
                    id="paint0_linear_105_2"
                    x1="9.5"
                    x2="93"
                    y1="54.5"
                    y2="54.5"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="white" />
                    <stop offset="1" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="clip0_105_2">
                    <rect width="100" height="100" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            <span className="text-lg font-semibold text-foreground">MilkStack</span>
        </div>
        {activeProjectId && (
          <ProjectSwitcher
            projects={projects}
            activeProjectId={activeProjectId}
            onProjectChange={onProjectChange}
            onDeleteProject={onDeleteProject}
          />
        )}
        <NewProjectDialog onNewProject={onNewProject} />
      </SidebarHeader>
      <Separator className="my-2" />
      <SidebarContent className="p-2">
        <AgentList agents={agents} onAgentsChange={onAgentsChange} />
      </SidebarContent>
      <Separator className="my-2" />
      <SidebarFooter>
        <SettingsDialog 
            settings={settings} 
            onSettingsChange={onSettingsChange}
            onExport={onExportProject}
            onImport={onImportProject}
            isProjectActive={!!activeProjectId}
        >
          <Button variant="ghost" className="w-full justify-start gap-2">
            <SettingsDialog.Icon className="h-4 w-4" />
            <span>Settings</span>
          </Button>
        </SettingsDialog>
      </SidebarFooter>
    </Sidebar>
  );
}
