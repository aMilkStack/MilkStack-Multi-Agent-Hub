import React, { ReactNode } from 'react';
import { SettingsProvider } from './SettingsContext';
import { ProjectProvider } from './ProjectContext';
import { RustyProvider } from './RustyContext';
import { ClaudeProvider } from './ClaudeContext';

/**
 * AppProvider combines all context providers into a single wrapper.
 * This ensures proper nesting order and simplifies the App.tsx setup.
 *
 * Provider hierarchy:
 * - SettingsProvider: Global app settings (API keys, etc.)
 * - ProjectProvider: Project management and state
 * - RustyProvider: Rusty (Gemini) code analysis (deprecated)
 * - ClaudeProvider: Claude Code analysis (new)
 */
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <SettingsProvider>
      <ProjectProvider>
        <RustyProvider>
          <ClaudeProvider>
            {children}
          </ClaudeProvider>
        </RustyProvider>
      </ProjectProvider>
    </SettingsProvider>
  );
};
