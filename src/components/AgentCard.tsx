import React from 'react';
import { Agent } from '../types';

interface AgentCardProps {
  agent: Agent;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const statusColor = agent.status === 'active' ? 'bg-brand-secondary' : 'bg-brand-bg-light';
  const statusText = agent.status === 'active' ? 'active' : 'idle';

  return (
    <div className="bg-brand-bg-dark p-3 rounded-lg flex items-center justify-between transition-all duration-300 hover:bg-brand-bg-light/50">
      <div className="flex items-center">
        <span className={`w-2.5 h-2.5 rounded-full mr-3 ${statusColor}`}></span>
        <div>
          <h3 className="font-semibold text-brand-text">{agent.name}</h3>
          <p className="text-sm text-brand-text-light">{agent.description}</p>
        </div>
      </div>
      <span className={`px-3 py-1 text-xs font-medium rounded-full ${agent.status === 'active' ? 'bg-brand-secondary text-brand-sidebar' : 'bg-brand-bg-light/50 text-brand-text-light'}`}>
        {statusText}
      </span>
    </div>
  );
};

export default AgentCard;