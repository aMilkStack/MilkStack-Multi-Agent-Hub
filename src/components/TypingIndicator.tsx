import React from 'react';
import { Agent } from '../types';

interface TypingIndicatorProps {
  agent: Agent | null;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ agent }) => {
  const author = agent || { name: 'Agent', avatar: 'AI', color: '#6b7280' }; // gray-500 fallback
  const isOrchestrator = author.name === 'Orchestrator';

  return (
    <div className="flex flex-row items-start gap-3">
      <div
        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-sm"
        style={{ backgroundColor: author.color }}
        title={isOrchestrator ? 'Orchestrator is routing...' : `${author.name} is thinking...`}
      >
        {author.avatar}
      </div>
      <div className={`flex flex-col max-w-2xl`}>
          <div className="flex items-center mb-1">
              <span className="font-semibold text-sm text-milk-light">{author.name}</span>
          </div>
          <div className="p-4 rounded-xl bg-milk-dark text-milk-lightest self-start">
            {isOrchestrator ? (
              <span className="text-sm text-milk-slate-light italic">Choosing next agent...</span>
            ) : (
              <div className="flex items-center space-x-1.5">
                  <div className="w-2 h-2 bg-milk-slate-light rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-milk-slate-light rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-milk-slate-light rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default TypingIndicator;