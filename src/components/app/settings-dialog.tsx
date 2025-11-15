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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cog } from 'lucide-react';
import type { Settings } from '@/lib/types';
import { MODELS } from '@/lib/agents';

interface SettingsDialogProps {
    children: ReactNode;
    settings: Settings;
    onSettingsChange: (settings: Settings) => void;
}

export function SettingsDialog({ children, settings, onSettingsChange }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<Settings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, open]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    setOpen(false);
  };

  const handleModelChange = (value: string) => {
    setLocalSettings(prev => ({ ...prev, aiModel: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure application-wide settings and preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="github-pat">GitHub Personal Access Token</Label>
            <Input 
              id="github-pat" 
              type="password" 
              placeholder="ghp_..."
              value={localSettings.githubPat}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, githubPat: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="model-selection">AI Model</Label>
             <Select 
                value={localSettings.aiModel}
                onValueChange={handleModelChange}
             >
                <SelectTrigger id="model-selection">
                    <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                    {MODELS.map(model => (
                        <SelectItem key={model.id} value={model.id} disabled={model.disabled}>
                            {model.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="global-rules">Global Rules</Label>
            <Textarea
              id="global-rules"
              placeholder="e.g., Always write code in TypeScript. Use functional components."
              className="min-h-[100px]"
              value={localSettings.globalRules}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, globalRules: e.target.value }))}
            />
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

SettingsDialog.Icon = Cog;
