import React from 'react';
import { Agent, AgentStatus } from '../../types';

interface AgentListItemProps {
  agent: Agent;
  activeAgentId: string | null;
}

const AgentListItem: React.FC<AgentListItemProps> = ({ agent, activeAgentId }) => {
  const isActive = agent.id === activeAgentId;
  const status = isActive ? AgentStatus.Active : agent.status;
  const statusColor = status === AgentStatus.Active ? 'bg-green-500' : 'bg-gray-500';

  return (
    <div className={`flex items-center p-2 rounded-md transition-colors cursor-pointer ${isActive ? 'bg-milk-dark-light' : 'hover:bg-milk-dark-light/50'}`}>
      <div 
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs mr-3"
        style={{ backgroundColor: agent.color }}
      >
        {agent.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-milk-lightest truncate" title={agent.name}>{agent.name}</p>
        <div className="flex items-center mt-0.5">
          <span className={`w-2 h-2 rounded-full ${statusColor} mr-1.5`}></span>
          <p className="text-xs text-milk-slate-light capitalize">{status}</p>
        </div>
      </div>
    </div>
  );
};

export default AgentListItem;