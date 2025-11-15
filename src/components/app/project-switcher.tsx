'use client';

import type { Project } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderGit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProjectSwitcherProps {
  projects: Project[];
  activeProjectId: string;
  onProjectChange: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

export function ProjectSwitcher({ projects, activeProjectId, onProjectChange, onDeleteProject }: ProjectSwitcherProps) {
  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleDelete = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    e.preventDefault();
    onDeleteProject(projectId);
  };

  return (
    <Select value={activeProjectId} onValueChange={onProjectChange}>
      <SelectTrigger className="w-full h-11">
        <div className="flex items-center gap-3">
          <FolderGit2 className="h-5 w-5 text-muted-foreground" />
          <SelectValue asChild>
            <span className="font-medium">{activeProject?.name ?? 'Select a project'}</span>
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {projects.length > 0 ? (
          projects.map(project => (
            <SelectItem key={project.id} value={project.id}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <FolderGit2 className="h-4 w-4" />
                  <span>{project.name}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => handleDelete(e, project.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </SelectItem>
          ))
        ) : (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No projects yet.</div>
        )}
      </SelectContent>
    </Select>
  );
}
