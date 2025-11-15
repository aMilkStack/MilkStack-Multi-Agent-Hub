import React from 'react';
import { AGENT_PROFILES } from '../../constants';
import AgentListItem from './AgentListItem';

interface AgentListProps {
  activeAgentId: string | null;
}

const AgentList: React.FC<AgentListProps> = ({ activeAgentId }) => {
  return (
    <div className="p-4 border-t border-milk-dark-light">
      <h2 className="text-lg font-semibold text-milk-light mb-3">Agents</h2>
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {AGENT_PROFILES.map(agent => (
          <AgentListItem key={agent.id} agent={agent} activeAgentId={activeAgentId} />
        ))}
      </div>
    </div>
  );
};

export default AgentList;