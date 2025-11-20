import React from 'react';
import { WorkflowState, SubTask } from '../types';

interface WorkflowStatusProps {
    state: WorkflowState;
}

const TaskItem: React.FC<{ task: SubTask; isActive: boolean }> = ({ task, isActive }) => {
    const getStatusIcon = (status: SubTask['status']) => {
        switch (status) {
            case 'pending': return '⏳';
            case 'in_progress': return '🔄';
            case 'completed': return '✅';
            case 'failed': return '❌';
        }
    };

    return (
        <div className={`p-3 mb-2 rounded-lg border ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span>{getStatusIcon(task.status)}</span>
                    <span className="font-medium">{task.title}</span>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    {task.assignedRole}
                </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-6">
                {task.description}
            </p>
            {task.output && (
                <div className="mt-2 ml-6 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs font-mono overflow-x-auto">
                    {task.output.substring(0, 100)}...
                </div>
            )}
        </div>
    );
};

export const WorkflowStatus: React.FC<WorkflowStatusProps> = ({ state }) => {
    return (
        <div className="w-full max-w-2xl mx-auto my-4 p-4 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Agency Workflow
                </h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium
          ${state.status === 'completed' ? 'bg-green-100 text-green-800' :
                        state.status === 'executing' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'}`}>
                    {state.status.toUpperCase()}
                </span>
            </div>

            <div className="space-y-2">
                {state.tasks.map((task, index) => (
                    <TaskItem
                        key={task.id}
                        task={task}
                        isActive={index === state.currentTaskIndex && state.status === 'executing'}
                    />
                ))}
            </div>
        </div>
    );
};
