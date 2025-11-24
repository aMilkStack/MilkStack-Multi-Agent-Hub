import React from 'react';
import type { ToolActivity } from '../../types/claude';
import { formatNumber } from '../../utils/formatters';

interface ToolActivityIndicatorProps {
  activities: ToolActivity[];
  className?: string;
}

/**
 * Tool Activity Indicator
 *
 * Displays the current tool activities when Rusty is using tools
 * like reading files, running commands, or searching.
 */
export const ToolActivityIndicator: React.FC<ToolActivityIndicatorProps> = ({
  activities,
  className = '',
}) => {
  if (activities.length === 0) {
    return null;
  }

  // Get running activities
  const runningActivities = activities.filter((a) => a.status === 'running');
  const completedActivities = activities.filter((a) => a.status === 'completed');

  return (
    <div className={`text-xs space-y-1 ${className}`}>
      {/* Running tools */}
      {runningActivities.map((activity, index) => (
        <div
          key={`running-${activity.toolName}-${index}`}
          className="flex items-center gap-2 text-milk-slate-light animate-pulse"
        >
          <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
          <span className="text-amber-400">{getToolIcon(activity.toolName)}</span>
          <span>
            {activity.description || `Using ${activity.toolName}...`}
          </span>
          {activity.elapsedSeconds !== undefined && (
            <span className="text-milk-slate">
              ({activity.elapsedSeconds.toFixed(1)}s)
            </span>
          )}
        </div>
      ))}

      {/* Completed tools (show last 3) */}
      {completedActivities.slice(-3).map((activity, index) => (
        <div
          key={`completed-${activity.toolName}-${index}`}
          className="flex items-center gap-2 text-milk-slate opacity-60"
        >
          <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full" />
          <span className="text-emerald-400">{getToolIcon(activity.toolName)}</span>
          <span>
            {activity.toolName} completed
          </span>
          {activity.elapsedSeconds !== undefined && (
            <span>({activity.elapsedSeconds.toFixed(1)}s)</span>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * Get an icon for a tool name
 */
function getToolIcon(toolName: string): string {
  const icons: Record<string, string> = {
    Read: '📖',
    Write: '✏️',
    Edit: '📝',
    MultiEdit: '📝',
    Glob: '🔍',
    Grep: '🔎',
    Bash: '💻',
    BashOutput: '📤',
    WebSearch: '🌐',
    WebFetch: '🔗',
    Task: '📋',
    Agent: '🤖',
  };
  return icons[toolName] || '⚙️';
}

/**
 * Session Info Display
 *
 * Shows current session information including cost and token usage
 */
interface SessionInfoProps {
  sessionId: string;
  numTurns: number;
  totalCostUsd: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  className?: string;
}

export const SessionInfo: React.FC<SessionInfoProps> = ({
  sessionId,
  numTurns,
  totalCostUsd,
  usage,
  className = '',
}) => {
  const totalTokens = usage.inputTokens + usage.outputTokens;

  return (
    <div className={`text-xs text-milk-slate space-y-1 ${className}`}>
      <div className="flex items-center justify-between">
        <span>Session:</span>
        <span className="font-mono text-milk-slate-light">{sessionId.slice(0, 8)}...</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Turns:</span>
        <span className="text-milk-slate-light">{numTurns}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Tokens:</span>
        <span className="text-milk-slate-light">{formatNumber(totalTokens)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span>Cost:</span>
        <span className="text-emerald-400">${totalCostUsd.toFixed(4)}</span>
      </div>
    </div>
  );
};

/**
 * Context Usage Bar
 *
 * Visual indicator of context window utilization
 */
interface ContextUsageBarProps {
  usedTokens: number;
  maxTokens: number;
  className?: string;
}

export const ContextUsageBar: React.FC<ContextUsageBarProps> = ({
  usedTokens,
  maxTokens,
  className = '',
}) => {
  const percentage = Math.min((usedTokens / maxTokens) * 100, 100);
  const isWarning = percentage > 60;
  const isCritical = percentage > 80;

  let barColor = 'bg-emerald-500';
  if (isCritical) {
    barColor = 'bg-red-500';
  } else if (isWarning) {
    barColor = 'bg-amber-500';
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between text-xs text-milk-slate">
        <span>Context:</span>
        <span className="text-milk-slate-light">
          {formatNumber(usedTokens)} / {formatNumber(maxTokens)}
        </span>
      </div>
      <div className="h-1.5 bg-milk-dark-light rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-xs text-right">
        <span className={isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'}>
          {percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};
