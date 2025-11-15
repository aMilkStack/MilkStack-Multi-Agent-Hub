'use client';

import { useState, useEffect, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Settings } from 'lucide-react';
import type { Agent } from '@/lib/types';

interface AgentSettingsDialogProps {
    children: ReactNode;
    agent: Agent;
    onAgentChange: (agent: Agent) => void;
}

export function AgentSettingsDialog({ children, agent, onAgentChange }: AgentSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [localAgent, setLocalAgent] = useState<Agent>(agent);

  useEffect(() => {
    setLocalAgent(agent);
  }, [agent, open]);

  const handleSave = () => {
    onAgentChange(localAgent);
    setOpen(false);
  };

  const isOrchestrator = agent.id === 'Orchestrator';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Agent: {agent.name}</DialogTitle>
          <DialogDescription>
            Modify the personality, role, and prompt for this agent.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="agent-name" className="text-right">Name</Label>
            <Input 
              id="agent-name" 
              className="col-span-3"
              value={localAgent.name}
              onChange={(e) => setLocalAgent(prev => ({ ...prev, name: e.target.value as any }))}
              disabled={isOrchestrator}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="agent-description" className="text-right">Description</Label>
            <Input 
              id="agent-description" 
              className="col-span-3"
              value={localAgent.description}
              onChange={(e) => setLocalAgent(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="agent-prompt">System Prompt</Label>
            <Textarea
              id="agent-prompt"
              placeholder="You are a helpful assistant..."
              className="min-h-[200px]"
              value={localAgent.prompt}
              onChange={(e) => setLocalAgent(prev => ({ ...prev, prompt: e.target.value }))}
              disabled={isOrchestrator}
            />
            {isOrchestrator && (
                <p className="text-xs text-muted-foreground">
                    The Orchestrator's prompt is dynamically generated based on the current agent list and cannot be edited directly.
                </p>
            )}
          </div>
        </div>
        <DialogFooter>
            <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
            </DialogClose>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

AgentSettingsDialog.Icon = Settings;
