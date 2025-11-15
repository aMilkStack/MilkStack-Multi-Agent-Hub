
import { Project, Settings } from '../../types';

const PROJECTS_STORAGE_KEY = 'milkstack_projects';
const SETTINGS_STORAGE_KEY = 'milkstack_settings';

// =================================================================
// Project Persistence
// =================================================================

/**
 * Loads all projects from localStorage.
 * @returns An array of Project objects, or an empty array if none are found or an error occurs.
 */
export const loadProjects = (): Project[] => {
  try {
    const serializedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
    return serializedProjects ? JSON.parse(serializedProjects) : [];
  } catch (error) {
    console.error("Failed to load or parse projects from localStorage:", error);
    return [];
  }
};

/**
 * Saves an array of projects to localStorage.
 * @param projects The array of Project objects to save.
 */
export const saveProjects = (projects: Project[]): void => {
  try {
    const serializedProjects = JSON.stringify(projects);
    localStorage.setItem(PROJECTS_STORAGE_KEY, serializedProjects);
  } catch (error) {
    console.error("Failed to save projects to localStorage:", error);
  }
};

/**
 * Creates a new project and persists the updated project list.
 * @param newProjectData An object containing the data for the new project, excluding the 'id'.
 * @returns The newly created project, including its generated id.
 */
export const createProject = (newProjectData: Omit<Project, 'id'>): Project => {
  const projects = loadProjects();
  const newProject: Project = {
    ...newProjectData,
    id: crypto.randomUUID(),
  };
  const updatedProjects = [...projects, newProject];
  saveProjects(updatedProjects);
  return newProject;
};

/**
 * Updates an existing project in storage.
 * @param updatedProject The complete project object to update.
 * @returns The updated project object if found, otherwise null.
 */
export const updateProject = (updatedProject: Project): Project | null => {
  const projects = loadProjects();
  const projectIndex = projects.findIndex(p => p.id === updatedProject.id);

  if (projectIndex === -1) {
    console.warn(`Project with id '${updatedProject.id}' not found for update.`);
    return null;
  }

  const updatedProjects = [...projects];
  updatedProjects[projectIndex] = updatedProject;
  
  saveProjects(updatedProjects);
  return updatedProject;
};

/**
 * Deletes a project from storage by its ID.
 * @param projectId The ID of the project to delete.
 * @returns boolean indicating if the deletion was successful.
 */
export const deleteProject = (projectId: string): boolean => {
  const projects = loadProjects();
  const newProjects = projects.filter(p => p.id !== projectId);

  if (projects.length === newProjects.length) {
    console.warn(`Project with id '${projectId}' not found for deletion.`);
    return false;
  }
  
  saveProjects(newProjects);
  return true;
};


// =================================================================
// Settings Persistence
// =================================================================

/**
 * Saves the settings object to localStorage.
 * @param settings The Settings object to save.
 */
export const saveSettings = (settings: Settings): void => {
  try {
    const serializedSettings = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, serializedSettings);
  } catch (error) {
    console.error("Failed to save settings to localStorage:", error);
  }
};

/**
 * Loads the settings object from localStorage.
 * @returns The Settings object if found, otherwise null.
 */
export const loadSettings = (): Settings | null => {
  try {
    const serializedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return serializedSettings ? JSON.parse(serializedSettings) : null;
  } catch (error) {
    console.error("Failed to load or parse settings from localStorage:", error);
    return null;
  }
};