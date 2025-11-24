import React, { useState } from 'react';
import { ActiveTaskState } from '../types';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Loader, Pause } from 'lucide-react';

interface WorkflowBlockProps {
  workflowState: ActiveTaskState;
  onExpand?: (expanded: boolean) => void;
}

const WorkflowBlock: React.FC<WorkflowBlockProps> = ({ workflowState, onExpand }) => {
  const [expandedTaskIndex, setExpandedTaskIndex] = useState<number | null>(
    workflowState.currentTaskIndex
  );

  const { taskMap, currentTaskIndex, currentStageIndex, status, collectedFeedback } = workflowState;
  const currentTask = taskMap.tasks[currentTaskIndex];
  const totalTasks = taskMap.tasks.length;
  const completedTasks = currentTaskIndex;
  const progress = (completedTasks / totalTasks) * 100;

  const getStatusIcon = (taskStatus: 'completed' | 'in_progress' | 'pending' | 'failed') => {
    switch (taskStatus) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'in_progress':
        return <Loader className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'pending':
        return <div className="w-5 h-5 rounded-full border-2 border-milk-slate" />;
      default:
        return null;
    }
  };

  const getWorkflowStatusBadge = () => {
    switch (status) {
      case 'in_progress':
        return (
          <span className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
            <Loader className="w-4 h-4 animate-spin" />
            In Progress
          </span>
        );
      case 'paused':
        return (
          <span className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-full text-sm">
            <Pause className="w-4 h-4" />
            Awaiting Approval
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-sm">
            <CheckCircle className="w-4 h-4" />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-300 rounded-full text-sm">
            <XCircle className="w-4 h-4" />
            Failed
          </span>
        );
    }
  };

  const toggleTaskExpansion = (taskIndex: number) => {
    const newExpanded = expandedTaskIndex === taskIndex ? null : taskIndex;
    setExpandedTaskIndex(newExpanded);
    onExpand?.(newExpanded !== null);
  };

  return (
    <div className="workflow-block bg-milk-dark/50 border border-milk-slate/30 rounded-lg p-4 mt-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-milk-lightest">{taskMap.title}</h3>
          {getWorkflowStatusBadge()}
        </div>
        <span className="text-sm text-milk-slate-light">
          Task {currentTaskIndex + 1} of {totalTasks}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-milk-slate-light mb-1">
          <span>Overall Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-milk-darkest rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {taskMap.tasks.map((task, taskIndex) => {
          const isExpanded = expandedTaskIndex === taskIndex;
          const isCurrentTask = taskIndex === currentTaskIndex;
          const taskStatus =
            taskIndex < currentTaskIndex
              ? 'completed'
              : taskIndex === currentTaskIndex
              ? status === 'failed'
                ? 'failed'
                : 'in_progress'
              : 'pending';

          return (
            <div
              key={task.id}
              className={`border rounded-lg transition-all ${
                isCurrentTask
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : 'border-milk-slate/20 bg-milk-darkest/50'
              }`}
            >
              {/* Task Header */}
              <button
                onClick={() => toggleTaskExpansion(taskIndex)}
                className="w-full flex items-center justify-between p-3 hover:bg-milk-dark/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(taskStatus)}
                  <div className="text-left">
                    <div className="font-medium text-milk-lightest">{task.objective}</div>
                    {isCurrentTask && (
                      <div className="text-xs text-milk-slate-light mt-1">
                        Stage {currentStageIndex + 1} of {task.stages.length}:{' '}
                        {task.stages[currentStageIndex]?.stageName}
                      </div>
                    )}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-milk-slate" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-milk-slate" />
                )}
              </button>

              {/* Expanded Task Details */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-milk-slate/20">
                  {/* Stages */}
                  <div className="mt-3">
                    <h4 className="text-sm font-semibold text-milk-slate-light mb-2">Stages:</h4>
                    <div className="space-y-2">
                      {task.stages.map((stage, stageIndex) => {
                        const isCurrentStage = isCurrentTask && stageIndex === currentStageIndex;
                        const isCompletedStage = isCurrentTask && stageIndex < currentStageIndex;

                        return (
                          <div
                            key={stageIndex}
                            className={`p-2 rounded ${
                              isCurrentStage
                                ? 'bg-blue-500/20 border border-blue-500/30'
                                : isCompletedStage
                                ? 'bg-green-500/10 border border-green-500/20'
                                : 'bg-milk-darkest/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isCompletedStage && <CheckCircle className="w-4 h-4 text-green-400" />}
                                {isCurrentStage && <Loader className="w-4 h-4 text-blue-400 animate-spin" />}
                                <span className="text-sm font-medium text-milk-lightest">
                                  {stage.stageName}
                                </span>
                              </div>
                              <span className="text-xs text-milk-slate-light">
                                {stage.agents.length} agent{stage.agents.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="text-xs text-milk-slate-light mt-1 ml-6">{stage.objective}</p>
                            {/* Agent List */}
                            <div className="mt-2 ml-6 flex flex-wrap gap-2">
                              {stage.agents.map((agent, agentIndex) => (
                                <span
                                  key={agentIndex}
                                  className="text-xs px-2 py-1 bg-milk-slate/20 text-milk-slate-light rounded"
                                >
                                  {agent.agent} ({agent.model})
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dependencies */}
                  {task.dependencies.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-milk-slate-light mb-2">Dependencies:</h4>
                      <div className="flex flex-wrap gap-2">
                        {task.dependencies.map((depId, depIndex) => {
                          const depTask = taskMap.tasks.find(t => t.id === depId);
                          return (
                            <span
                              key={depIndex}
                              className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded"
                            >
                              {depTask?.objective || depId}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Collected Feedback Section */}
      {collectedFeedback.length > 0 && (
        <div className="mt-4 p-3 bg-milk-darkest/50 border border-milk-slate/20 rounded-lg">
          <h4 className="text-sm font-semibold text-milk-slate-light mb-2">Agent Feedback:</h4>
          <div className="space-y-2">
            {collectedFeedback.map((feedback, index) => (
              <div key={index} className="text-sm">
                <span className="font-medium text-blue-300">{feedback.agentName}:</span>
                <p className="text-milk-slate-light ml-4 mt-1">{feedback.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowBlock;
