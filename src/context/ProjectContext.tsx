import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Project } from '../types/project';
import { Message } from '../types/message';
import * as indexedDbService from '../services/indexedDbService';
import { toast } from 'react-toastify';

interface ProjectContextValue {
  projects: Project[];
  activeProjectId: string | null;
  createProject: (name: string, codebaseContext: string, initialMessage?: string) => { project: Project; initialMessage?: string };
  selectProject: (id: string) => void;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => void;
  renameProject: (id: string, newName: string) => void;
  updateMessages: (projectId: string, messages: Message[]) => void;
  updateCodebase: (projectId: string, codebaseContext: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Load projects on mount
  useEffect(() => {
    const loadData = async () => {
      let loadedProjects = await indexedDbService.loadProjects();

      // Sanitize zombie workflows (projects that were 'in_progress' when browser closed)
      let projectsChanged = false;
      loadedProjects = loadedProjects.map(p => {
        if (p.activeTaskState && p.activeTaskState.status === 'in_progress') {
          projectsChanged = true;
          return {
            ...p,
            activeTaskState: {
              ...p.activeTaskState,
              status: 'paused' as const,
            },
          };
        }
        return p;
      });

      if (projectsChanged) {
        await indexedDbService.saveProjects(loadedProjects);
        toast.info('Resumed projects were paused. Click "Approve" to continue execution.');
      }

      setProjects(loadedProjects);
    };

    loadData().catch(error => {
      console.error('Failed to load projects:', error);
      toast.error('Failed to load projects from storage');
    });
  }, []);

  // Save projects whenever they change (debounced)
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      if (projects.length > 0) {
        indexedDbService.saveProjects(projects).catch(error => {
          console.error('Failed to save projects:', error);
        });
      }
    }, 1000); // Wait 1 second after last change

    return () => clearTimeout(saveTimeout);
  }, [projects]);

  const createProject = useCallback((name: string, codebaseContext: string, initialMessage?: string) => {
    const newProject = indexedDbService.createProject({
      name,
      messages: [],
      codebaseContext,
    });
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    toast.success(`Project "${name}" created successfully!`);

    return { project: newProject, initialMessage };
  }, []);

  const selectProject = useCallback((id: string) => {
    setActiveProjectId(id);
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    await indexedDbService.deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }
    toast.success('Project deleted');
  }, [activeProjectId]);

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
    indexedDbService.updateProject(id, updates).catch(error => {
      console.error('Failed to update project in DB:', error);
      toast.error('Failed to save project changes');
    });
  }, []);

  const renameProject = useCallback((id: string, newName: string) => {
    setProjects(prev =>
      prev.map(p => (p.id === id ? { ...p, name: newName } : p))
    );
    toast.success('Project renamed!');
  }, []);

  const updateMessages = useCallback((projectId: string, messages: Message[]) => {
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, messages } : p))
    );
  }, []);

  const updateCodebase = useCallback((projectId: string, codebaseContext: string) => {
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, codebaseContext } : p))
    );
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProjectId,
        createProject,
        selectProject,
        deleteProject,
        updateProject,
        renameProject,
        updateMessages,
        updateCodebase,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within ProjectProvider');
  }
  return context;
};
