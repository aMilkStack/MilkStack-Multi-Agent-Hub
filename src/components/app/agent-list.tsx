'use client';

import type { Agent, AgentStatus } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AgentSettingsDialog } from './agent-settings-dialog';

interface AgentListProps {
  agents: Agent[];
  onAgentsChange: (agents: Agent[]) => void;
}

export function AgentList({ agents, onAgentsChange }: AgentListProps) {
  const handleAgentChange = (updatedAgent: Agent) => {
    onAgentsChange(agents.map(a => a.id === updatedAgent.id ? updatedAgent : a));
  };
  
  const agentStatuses = Object.fromEntries(agents.map(agent => [agent.name, agent.status])) as Record<string, AgentStatus>;

  return (
    <div className="space-y-4">
      <h3 className="px-2 text-sm font-semibold tracking-tight text-muted-foreground">Active Staff</h3>
      <ul className="space-y-2">
        {agents.map(agent => (
          <li key={agent.id} className="group/item relative">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-3 rounded-md p-2 pr-8 transition-colors hover:bg-accent/50">
                    <Avatar className={cn("h-6 w-6 text-xs", agent.color)}>
                        <AvatarFallback>{agent.avatar}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate font-medium">{agent.name}</span>
                    <div
                      className={cn(
                        'dot',
                        agentStatuses[agent.name] === 'active' ? 'dot-active' : 'dot-idle'
                      )}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  <p>{agent.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
             <AgentSettingsDialog agent={agent} onAgentChange={handleAgentChange}>
                <button className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 focus:opacity-100 transition-opacity">
                    <AgentSettingsDialog.Icon className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
            </AgentSettingsDialog>
          </li>
        ))}
      </ul>
    </div>
  );
}
