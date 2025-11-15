import Dexie, { Table } from 'dexie';
import { Project, Settings } from '../../types';

/**
 * IndexedDB database for MilkStack Multi-Agent Hub
 * Provides persistent storage with much larger capacity than localStorage
 */
class MilkStackDatabase extends Dexie {
  projects!: Table<Project, string>;
  settings!: Table<Settings & { id: string }, string>;

  constructor() {
    super('MilkStackDB');

    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      settings: 'id'
    });
  }
}

const db = new MilkStackDatabase();

/**
 * Load all projects from IndexedDB
 */
export const loadProjects = async (): Promise<Project[]> => {
  try {
    const projects = await db.projects.toArray();
    // Sort by most recently updated
    return projects.sort((a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime()
    );
  } catch (error) {
    console.error('Failed to load projects from IndexedDB:', error);
    return [];
  }
};

/**
 * Save all projects to IndexedDB
 */
export const saveProjects = async (projects: Project[]): Promise<void> => {
  try {
    await db.transaction('rw', db.projects, async () => {
      // Clear existing projects and add new ones
      await db.projects.clear();
      await db.projects.bulkAdd(projects);
    });
  } catch (error) {
    console.error('Failed to save projects to IndexedDB:', error);
    throw error;
  }
};

/**
 * Create a new project
 */
export const createProject = (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project => {
  const now = new Date();
  return {
    ...projectData,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Update a single project
 */
export const updateProject = async (projectId: string, updates: Partial<Project>): Promise<void> => {
  try {
    await db.projects.update(projectId, {
      ...updates,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Failed to update project:', error);
    throw error;
  }
};

/**
 * Delete a project
 */
export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    await db.projects.delete(projectId);
  } catch (error) {
    console.error('Failed to delete project:', error);
    throw error;
  }
};

/**
 * Load settings from IndexedDB
 */
export const loadSettings = async (): Promise<Settings | null> => {
  try {
    const settingsDoc = await db.settings.get('default');
    if (!settingsDoc) return null;

    const { id, ...settings } = settingsDoc;
    return settings;
  } catch (error) {
    console.error('Failed to load settings from IndexedDB:', error);
    return null;
  }
};

/**
 * Save settings to IndexedDB
 */
export const saveSettings = async (settings: Settings): Promise<void> => {
  try {
    await db.settings.put({ ...settings, id: 'default' });
  } catch (error) {
    console.error('Failed to save settings to IndexedDB:', error);
    throw error;
  }
};

/**
 * Migrate data from localStorage to IndexedDB
 * This should be called once on app initialization
 */
export const migrateFromLocalStorage = async (): Promise<boolean> => {
  try {
    // Check if migration is needed
    const existingProjects = await db.projects.count();
    if (existingProjects > 0) {
      // Already migrated
      return false;
    }

    // Try to load from localStorage
    const localStorageProjects = localStorage.getItem('milkstack_projects');
    const localStorageSettings = localStorage.getItem('milkstack_settings');

    let migrated = false;

    if (localStorageProjects) {
      try {
        const projects: Project[] = JSON.parse(localStorageProjects);
        if (projects.length > 0) {
          await db.projects.bulkAdd(projects);
          migrated = true;
        }
      } catch (error) {
        console.error('Failed to parse localStorage projects:', error);
      }
    }

    if (localStorageSettings) {
      try {
        const settings: Settings = JSON.parse(localStorageSettings);
        await db.settings.put({ ...settings, id: 'default' });
        migrated = true;
      } catch (error) {
        console.error('Failed to parse localStorage settings:', error);
      }
    }

    if (migrated) {
      console.log('Successfully migrated data from localStorage to IndexedDB');
      // Optionally clear localStorage after successful migration
      // localStorage.removeItem('milkstack_projects');
      // localStorage.removeItem('milkstack_settings');
    }

    return migrated;
  } catch (error) {
    console.error('Migration from localStorage failed:', error);
    return false;
  }
};

/**
 * Export all projects to JSON
 */
export const exportProjects = async (): Promise<string> => {
  try {
    const projects = await db.projects.toArray();
    const settings = await loadSettings();

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
      settings,
    };

    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    console.error('Failed to export projects:', error);
    throw error;
  }
};

/**
 * Import projects from JSON
 */
export const importProjects = async (jsonData: string): Promise<{ projectsCount: number; settingsImported: boolean }> => {
  try {
    const data = JSON.parse(jsonData);

    if (!data.version || !data.projects) {
      throw new Error('Invalid export file format');
    }

    let projectsCount = 0;
    let settingsImported = false;

    // Import projects
    if (Array.isArray(data.projects) && data.projects.length > 0) {
      await db.projects.bulkAdd(data.projects);
      projectsCount = data.projects.length;
    }

    // Import settings
    if (data.settings) {
      await saveSettings(data.settings);
      settingsImported = true;
    }

    return { projectsCount, settingsImported };
  } catch (error) {
    console.error('Failed to import projects:', error);
    throw error;
  }
};

/**
 * Get database storage estimate
 */
export const getStorageEstimate = async (): Promise<{ usage: number; quota: number; percentage: number } | null> => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentage = quota > 0 ? (usage / quota) * 100 : 0;

      return {
        usage,
        quota,
        percentage
      };
    } catch (error) {
      console.error('Failed to get storage estimate:', error);
    }
  }
  return null;
};

export default db;
