'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PlusCircle, Github } from 'lucide-react';
import type { ProjectType } from '@/lib/types';

interface NewProjectDialogProps {
  onNewProject: (name: string, type: ProjectType, githubUrl?: string) => void;
}

export function NewProjectDialog({ onNewProject }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('new_cycle');

  const handleCreateProject = () => {
    if (projectName.trim()) {
      onNewProject(projectName.trim(), projectType, githubUrl.trim());
      setProjectName('');
      setGithubUrl('');
      setProjectType('new_cycle');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <PlusCircle className="h-4 w-4 mr-2" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create a New Project</DialogTitle>
          <DialogDescription>
            Provide some context for your new project to get started.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="e.g., 'My Awesome App'"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="github-url">
                <div className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    GitHub Repository (Optional)
                </div>
            </Label>
            <Input
              id="github-url"
              placeholder="https://github.com/user/repo"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Providing a repository allows agents to analyze your existing codebase.
            </p>
          </div>
          <div className="grid gap-4">
            <Label>Project Goal</Label>
            <RadioGroup value={projectType} onValueChange={(value: ProjectType) => setProjectType(value)}>
              <div className="flex items-start space-x-2 rounded-md border p-3">
                <RadioGroupItem value="new_cycle" id="new_cycle" />
                <Label htmlFor="new_cycle" className="flex flex-col space-y-1 font-normal">
                  <span>Start new development cycle</span>
                  <span className="text-xs text-muted-foreground">
                    For new ideas or major features. Agents will perform market research, planning, and design.
                  </span>
                </Label>
              </div>
              <div className="flex items-start space-x-2 rounded-md border p-3">
                <RadioGroupItem value="existing_codebase" id="existing_codebase" />
                <Label htmlFor="existing_codebase" className="flex flex-col space-y-1 font-normal">
                  <span>Work on an existing codebase</span>
                  <span className="text-xs text-muted-foreground">
                    For bug fixes, questions, or incremental changes to an existing repository.
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleCreateProject} disabled={!projectName.trim()}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
