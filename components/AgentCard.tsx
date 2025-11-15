import React from 'react';
import { Agent, AgentStatus } from '../types';

interface AgentCardProps {
  agent: Agent;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const statusColor = agent.status === AgentStatus.Active ? 'bg-green-500' : 'bg-gray-500';
  
  return (
    <div 
      className="bg-milk-dark rounded-lg p-6 shadow-lg border border-milk-dark-light hover:border-milk-slate/50 hover:scale-[1.02] transform transition-all duration-300 ease-in-out flex flex-col group"
      style={{ '--agent-color': agent.color } as React.CSSProperties}
    >
      <div className="flex items-center mb-4">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl mr-4"
          style={{ backgroundColor: agent.color }}
        >
          {agent.avatar}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-milk-lightest group-hover:text-milk-slate transition-colors">{agent.name}</h3>
          <div className="flex items-center mt-1">
            <span className={`w-2.5 h-2.5 rounded-full ${statusColor} mr-2`}></span>
            <p className="text-sm font-semibold text-milk-slate-light capitalize">{agent.status}</p>
          </div>
        </div>
      </div>
      <p className="text-milk-light text-base leading-relaxed flex-grow">{agent.description}</p>
    </div>
  );
};

export default AgentCard;