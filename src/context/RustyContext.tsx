import React, { createContext, useContext, useState, ReactNode } from 'react';

interface RustyContextValue {
  rustyCodebaseContext: string;
  isRustyConnected: boolean;
  updateCodebase: (context: string) => void;
  setConnectionStatus: (connected: boolean) => void;
}

const RustyContext = createContext<RustyContextValue | undefined>(undefined);

export const RustyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rustyCodebaseContext, setRustyCodebaseContext] = useState('');
  const [isRustyConnected, setIsRustyConnected] = useState(false);

  const updateCodebase = (context: string) => {
    setRustyCodebaseContext(context);
  };

  const setConnectionStatus = (connected: boolean) => {
    setIsRustyConnected(connected);
  };

  return (
    <RustyContext.Provider
      value={{
        rustyCodebaseContext,
        isRustyConnected,
        updateCodebase,
        setConnectionStatus,
      }}
    >
      {children}
    </RustyContext.Provider>
  );
};

export const useRusty = () => {
  const context = useContext(RustyContext);
  if (!context) {
    throw new Error('useRusty must be used within RustyProvider');
  }
  return context;
};
