import React from 'react';

interface ExecutionReadyPromptProps {
  onStartExecution: () => void;
  onContinueDiscussion: () => void;
}

const ExecutionReadyPrompt: React.FC<ExecutionReadyPromptProps> = ({
  onStartExecution,
  onContinueDiscussion
}) => {
  return (
    <div className="bg-milk-dark-light border-2 border-green-500/30 rounded-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-milk-lightest mb-2">
            Ready for Implementation
          </h3>
          <p className="text-milk-slate-light text-sm mb-4">
            The team has reached consensus on the approach. Start implementation to create a detailed plan and begin building.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={onStartExecution}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Start Implementation
            </button>
            
            <button
              onClick={onContinueDiscussion}
              className="px-4 py-2 bg-milk-dark hover:bg-milk-dark-light text-milk-light font-medium rounded-lg transition-colors border border-milk-slate"
            >
              Continue Discussion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionReadyPrompt;
