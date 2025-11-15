'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app/sidebar';
import { ChatView } from '@/components/app/chat-view';
import { useProjectManager } from '@/hooks/use-project-manager';

export default function Home({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
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
    handleDeleteProject,
    setActiveProjectId,
    setAgents,
    setSettings,
    handleExportProject,
    handleImportProject,
    handleStopGeneration,
  } = useProjectManager();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar
          projects={projects}
          activeProjectId={activeProjectId}
          onProjectChange={setActiveProjectId}
          onNewProject={handleNewProject}
          onDeleteProject={handleDeleteProject}
          agents={agents}
          onAgentsChange={setAgents}
          settings={settings}
          onSettingsChange={setSettings}
          onExportProject={handleExportProject}
          onImportProject={handleImportProject}
        />
        <SidebarInset className="flex-1">
           <ChatView
            messages={activeProject?.messages ?? []}
            onSendMessage={handleSendMessage}
            isTyping={isTyping}
            agentStatuses={agentStatuses}
            onStopGeneration={handleStopGeneration}
           />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
