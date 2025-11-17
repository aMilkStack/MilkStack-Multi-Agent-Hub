import React, { useState } from 'react';
import { AgentProposedChanges, ProposedChange } from '../../types';

interface ProposedChangesViewerProps {
  proposedChanges: AgentProposedChanges;
  onApprove: (changes: AgentProposedChanges) => void;
  onReject: () => void;
}

const ProposedChangesViewer: React.FC<ProposedChangesViewerProps> = ({
  proposedChanges,
  onApprove,
  onReject,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const getActionColor = (action: ProposedChange['action']) => {
    switch (action) {
      case 'add':
        return 'text-green-400';
      case 'modify':
        return 'text-yellow-400';
      case 'delete':
        return 'text-red-400';
      default:
        return 'text-milk-slate-light';
    }
  };

  const getActionIcon = (action: ProposedChange['action']) => {
    switch (action) {
      case 'add':
        return '+';
      case 'modify':
        return '~';
      case 'delete':
        return '-';
      default:
        return '?';
    }
  };

  return (
    <div className="mt-4 border border-milk-dark-light rounded-lg bg-milk-dark/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-milk-dark-light/30 border-b border-milk-dark-light">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-md flex items-center justify-center text-white font-bold">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-milk-lightest">
              Proposed Code Changes
            </h3>
            <p className="text-xs text-milk-slate-light">
              {proposedChanges.changes.length} file{proposedChanges.changes.length !== 1 ? 's' : ''} affected
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-milk-slate-light hover:text-white transition-colors p-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          {/* Metadata */}
          {(proposedChanges.commitMessageHint || proposedChanges.branchNameHint) && (
            <div className="p-3 bg-milk-dark/60 border-b border-milk-dark-light space-y-2">
              {proposedChanges.commitMessageHint && (
                <div>
                  <span className="text-xs text-milk-slate-light font-semibold">Commit Message:</span>
                  <p className="text-sm text-milk-lightest font-mono">{proposedChanges.commitMessageHint}</p>
                </div>
              )}
              {proposedChanges.branchNameHint && (
                <div>
                  <span className="text-xs text-milk-slate-light font-semibold">Branch:</span>
                  <p className="text-sm text-milk-lightest font-mono">{proposedChanges.branchNameHint}</p>
                </div>
              )}
            </div>
          )}

          {/* Changes List */}
          <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
            {proposedChanges.changes.map((change, index) => (
              <div
                key={index}
                className="border border-milk-dark-light rounded-md bg-milk-darkest/50 overflow-hidden"
              >
                <div className="flex items-center gap-2 p-2 bg-milk-dark-light/20">
                  <span className={`font-mono font-bold ${getActionColor(change.action)}`}>
                    {getActionIcon(change.action)}
                  </span>
                  <span className="text-sm font-mono text-milk-lightest">{change.filePath}</span>
                  <span className={`ml-auto text-xs font-semibold ${getActionColor(change.action)}`}>
                    {change.action.toUpperCase()}
                  </span>
                </div>

                {/* Content/Diff Preview */}
                {change.action !== 'delete' && (
                  <div className="p-2 bg-milk-darkest">
                    <pre className="text-xs text-milk-slate-light font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                      {change.diff || (change.content ? change.content.slice(0, 500) + (change.content.length > 500 ? '\n...' : '') : 'No preview available')}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 p-3 bg-milk-dark-light/30 border-t border-milk-dark-light">
            <button
              onClick={() => onApprove(proposedChanges)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Approve & Apply
            </button>
            <button
              onClick={onReject}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Reject
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ProposedChangesViewer;
