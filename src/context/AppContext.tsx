import React, { ReactNode } from 'react';
import { SettingsProvider } from './SettingsContext';
import { ProjectProvider } from './ProjectContext';
import { RustyProvider } from './RustyContext';

/**
 * AppProvider combines all context providers into a single wrapper.
 * This ensures proper nesting order and simplifies the App.tsx setup.
 */
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <SettingsProvider>
      <ProjectProvider>
        <RustyProvider>
          {children}
        </RustyProvider>
      </ProjectProvider>
    </SettingsProvider>
  );
};
