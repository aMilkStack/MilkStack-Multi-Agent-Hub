import React, { useState } from 'react';
import { ActiveTaskState } from '../types';
import { CheckCircle, Edit3, XCircle, AlertCircle } from 'lucide-react';

interface WorkflowApprovalPromptProps {
  workflowState: ActiveTaskState;
  onApprove: () => void;
  onEdit: (editedPlan: ActiveTaskState) => void;
  onCancel: () => void;
}

const WorkflowApprovalPrompt: React.FC<WorkflowApprovalPromptProps> = ({
  workflowState,
  onApprove,
  onEdit,
  onCancel,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedState, setEditedState] = useState<ActiveTaskState>(workflowState);

  const handleApprove = () => {
    onApprove();
  };

  const handleSaveEdit = () => {
    onEdit(editedState);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (isEditing) {
      setIsEditing(false);
      setEditedState(workflowState);
    } else {
      onCancel();
    }
  };

  const updateTaskObjective = (taskIndex: number, newObjective: string) => {
    setEditedState(prev => ({
      ...prev,
      taskMap: {
        ...prev.taskMap,
        tasks: prev.taskMap.tasks.map((task, index) =>
          index === taskIndex ? { ...task, objective: newObjective } : task
        ),
      },
    }));
  };

  const updateStageObjective = (taskIndex: number, stageIndex: number, newObjective: string) => {
    setEditedState(prev => ({
      ...prev,
      taskMap: {
        ...prev.taskMap,
        tasks: prev.taskMap.tasks.map((task, tIndex) =>
          tIndex === taskIndex
            ? {
                ...task,
                stages: task.stages.map((stage, sIndex) =>
                  sIndex === stageIndex ? { ...stage, objective: newObjective } : stage
                ),
              }
            : task
        ),
      },
    }));
  };

  return (
    <div className="workflow-approval-prompt bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/50 rounded-lg p-6 mt-4">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <AlertCircle className="w-8 h-8 text-yellow-400 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="text-xl font-bold text-yellow-200 mb-2">Workflow Plan Approval Required</h3>
          <p className="text-milk-slate-light text-sm">
            The Orchestrator has created a multi-stage workflow plan. Please review and approve to proceed.
          </p>
        </div>
      </div>

      {/* Workflow Summary */}
      <div className="bg-milk-darkest/50 rounded-lg p-4 mb-6">
        <h4 className="text-lg font-semibold text-milk-lightest mb-2">{workflowState.taskMap.title}</h4>
        <p className="text-sm text-milk-slate-light mb-4">{workflowState.taskMap.description}</p>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-milk-dark/50 rounded p-3">
            <div className="text-2xl font-bold text-blue-300">{workflowState.taskMap.tasks.length}</div>
            <div className="text-xs text-milk-slate-light">Total Tasks</div>
          </div>
          <div className="bg-milk-dark/50 rounded p-3">
            <div className="text-2xl font-bold text-purple-300">
              {workflowState.taskMap.tasks.reduce((sum, task) => sum + task.stages.length, 0)}
            </div>
            <div className="text-xs text-milk-slate-light">Total Stages</div>
          </div>
          <div className="bg-milk-dark/50 rounded p-3">
            <div className="text-2xl font-bold text-green-300">
              {workflowState.taskMap.tasks.reduce(
                (sum, task) =>
                  sum + task.stages.reduce((stageSum, stage) => stageSum + stage.agents.length, 0),
                0
              )}
            </div>
            <div className="text-xs text-milk-slate-light">Total Agents</div>
          </div>
        </div>
      </div>

      {/* Task Plan */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-milk-lightest mb-3">Execution Plan:</h4>
        <div className="space-y-3">
          {(isEditing ? editedState : workflowState).taskMap.tasks.map((task, taskIndex) => (
            <div key={task.id} className="bg-milk-darkest/50 border border-milk-slate/20 rounded-lg p-4">
              {/* Task Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 text-blue-300 rounded-full flex items-center justify-center text-sm font-bold">
                  {taskIndex + 1}
                </div>
                <div className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={task.objective}
                      onChange={e => updateTaskObjective(taskIndex, e.target.value)}
                      className="w-full bg-milk-dark border border-milk-slate/30 rounded px-3 py-2 text-milk-lightest focus:border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <h5 className="font-semibold text-milk-lightest">{task.objective}</h5>
                  )}

                  {/* Dependencies */}
                  {task.dependencies.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-milk-slate-light">Depends on:</span>
                      <div className="flex flex-wrap gap-1">
                        {task.dependencies.map((depId, depIndex) => {
                          const depTask = workflowState.taskMap.tasks.find(t => t.id === depId);
                          const depTaskNumber = workflowState.taskMap.tasks.indexOf(depTask!);
                          return (
                            <span
                              key={depIndex}
                              className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded"
                            >
                              Task {depTaskNumber + 1}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stages */}
              <div className="ml-11 space-y-2">
                {task.stages.map((stage, stageIndex) => (
                  <div key={stageIndex} className="bg-milk-dark/30 rounded p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-xs text-blue-300 font-medium">{stage.stageName}</span>
                    </div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={stage.objective}
                        onChange={e => updateStageObjective(taskIndex, stageIndex, e.target.value)}
                        className="w-full bg-milk-darkest border border-milk-slate/30 rounded px-2 py-1 text-sm text-milk-lightest focus:border-blue-500 focus:outline-none"
                      />
                    ) : (
                      <p className="text-sm text-milk-slate-light">{stage.objective}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {stage.agents.map((agent, agentIndex) => (
                        <span
                          key={agentIndex}
                          className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded"
                        >
                          {agent.agent} ({agent.model})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        {isEditing ? (
          <>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-milk-slate/20 hover:bg-milk-slate/30 text-milk-lightest rounded transition-colors"
            >
              Cancel Edit
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Save & Approve
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 rounded transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancel Workflow
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-milk-slate/20 hover:bg-milk-slate/30 text-milk-lightest border border-milk-slate/50 rounded transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit Plan
            </button>
            <button
              onClick={handleApprove}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Approve & Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default WorkflowApprovalPrompt;
