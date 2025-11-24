import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Settings } from '../types/project';
import * as indexedDbService from '../services/indexedDbService';

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>({
    // apiKey and claudeApiKey removed - now read from environment variables (.env file)
    githubPat: '',
    globalRules: '',
    model: 'gemini-2.5-pro',
  });

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const loaded = await indexedDbService.loadSettings();
      if (loaded) {
        setSettings(loaded);
      }
    };
    loadSettings();
  }, []);

  // Save settings whenever they change
  useEffect(() => {
    indexedDbService.saveSettings(settings).catch(error => {
      console.error('Failed to save settings:', error);
    });
  }, [settings]);

  const updateSettings = (newSettings: Settings) => {
    setSettings(newSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
