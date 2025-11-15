'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app/sidebar';
import { ChatView } from '@/components/app/chat-view';
import { useProjectManager } from '@/hooks/use-project-manager';

export default function Home() {
  const {
    projects,
    activeProjectId,
    agents,
    settings,
    isTyping,
    activeProject,
    agentStatuses,
    handleNewProject,
    handleSendMessage,
    setActiveProjectId,
    setAgents,
    setSettings,
  } = useProjectManager();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onProjectChange={setActiveProjectId}
          onNewProject={handleNewProject}
          agents={agents}
          onAgentsChange={setAgents}
          settings={settings}
          onSettingsChange={setSettings}
        />
        <SidebarInset className="flex-1">
           <ChatView
            messages={activeProject?.messages ?? []}
            onSendMessage={handleSendMessage}
            isTyping={isTyping}
            agentStatuses={agentStatuses}
           />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
