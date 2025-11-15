import { Project } from '../types';

const PROJECTS_STORAGE_KEY = 'milstack_projects';

export function saveProjects(projects: Project[]): void {
    try {
        const data = JSON.stringify(projects);
        localStorage.setItem(PROJECTS_STORAGE_KEY, data);
    } catch (error) {
        console.error("Error saving projects to localStorage:", error);
    }
}

export function loadProjects(): Project[] {
    try {
        const data = localStorage.getItem(PROJECTS_STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error loading projects from localStorage:", error);
    }
    return [];
}
