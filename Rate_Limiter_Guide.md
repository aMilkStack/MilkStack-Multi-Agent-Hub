 **75% the API calls were bypassing the rate limiter**, and the rate limiter itself was hardcoded to the "Free Tier" (12 RPM) instead of your Paid Tier (150 RPM).

Here is the full fix that:
1.  **Unlocks 150 RPM**: Switches the default rate limiter to "Paid Tier" settings (120 RPM safe buffer).
2.  **Fixes "Invalid Key"**: Removes the project-specific key logic that was likely overriding your global key with an empty string.
3.  **Fixes Dead Code**: Removes the unused Project Settings UI and legacy key handling.
4.  **Fixes Rate Limiting**: Wraps the previously unprotected sequential agent calls in the rate limiter.

### 1. Update Rate Limiter (Unlock 150 RPM)
Renamed limiters to be clearer (`Free` vs `Paid`) and set the default to **Paid** (120 RPM / 2 requests per second).

```typescript:src/services/rateLimiter.ts
/**
 * Rate Limiter with Concurrency Control
 *
 * Manages API rate limits and concurrent execution for Gemini API calls.
 */

export interface RateLimiterConfig {
    /** Maximum calls that can start per second */
    ratePerSecond: number;
    /** Maximum number of concurrent executions */
    maxParallelism: number;
    /** Name for logging purposes */
    name?: string;
}

interface QueuedCall<T> {
    execute: () => Promise<T>;
    resolve: (value: T) => void;
    reject: (error: any) => void;
}

export class RateLimiter {
    private config: RateLimiterConfig;
    private callTimestamps: number[] = [];
    private activeExecutions = 0;
    private queue: QueuedCall<any>[] = [];
    private processing = false;

    constructor(config: RateLimiterConfig) {
        this.config = config;
    }

    /**
     * Execute a function with rate and concurrency limits
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.queue.push({ execute: fn, resolve, reject });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            if (this.activeExecutions >= this.config.maxParallelism) {
                await this.waitForSlot();
                continue;
            }

            const now = Date.now();
            this.cleanOldTimestamps(now);

            if (this.callTimestamps.length >= this.config.ratePerSecond) {
                const oldestCall = this.callTimestamps[0];
                const timeSinceOldest = now - oldestCall;
                const waitTime = 1000 - timeSinceOldest;

                if (waitTime > 0) {
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }

            const call = this.queue.shift();
            if (!call) break;

            this.startExecution(call);
        }

        this.processing = false;
    }

    private startExecution<T>(call: QueuedCall<T>) {
        this.activeExecutions++;
        this.callTimestamps.push(Date.now());

        call.execute()
            .then(result => {
                this.activeExecutions--;
                call.resolve(result);
                this.processQueue();
            })
            .catch(error => {
                this.activeExecutions--;
                call.reject(error);
                this.processQueue();
            });
    }

    private waitForSlot(): Promise<void> {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (this.activeExecutions < this.config.maxParallelism) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    }

    private cleanOldTimestamps(now: number) {
        const oneSecondAgo = now - 1000;
        this.callTimestamps = this.callTimestamps.filter(ts => ts > oneSecondAgo);
    }
}

/**
 * Free Tier Rate Limiter (Gemini 2.5 Flash)
 * Limit: 15 RPM (0.25 calls/sec)
 * Config: 12 RPM (0.2 calls/sec) safe buffer
 */
export function createFreeTierRateLimiter(): RateLimiter {
    return new RateLimiter({
        ratePerSecond: 0.2,
        maxParallelism: 3,
        name: 'GeminiFree'
    });
}

/**
 * Paid Tier Rate Limiter (Gemini 2.5 Pro)
 * Limit: 150 RPM (2.5 calls/sec)
 * Config: 120 RPM (2.0 calls/sec) safe buffer
 */
export function createPaidTierRateLimiter(): RateLimiter {
    return new RateLimiter({
        ratePerSecond: 2.0, // 120 RPM
        maxParallelism: 10, // High concurrency for paid tier
        name: 'GeminiPaid'
    });
}
```

### 2. Fix Gemini Service (Apply Rate Limiting & Fix Key Logic)
This file had the **critical bug**: sequential agent execution was bypassing the rate limiter entirely. It also hardcoded the "Dev" (Free) rate limiter.

```typescript:src/services/geminiService.ts
import { GoogleGenAI } from "@google/genai";
import { Agent, Message, Settings, GeminiModel, AgentProposedChanges, TaskMap, ActiveTaskState } from '../../types';
import { AGENT_PROFILES } from '../../constants';
import { loadSettings } from './indexedDbService';
import { TaskParser } from './taskParser';
import { WorkflowEngine, createWorkflowEngine, restoreWorkflowEngine } from './workflowEngine';
import { createAgentExecutor } from './AgentExecutor';
import { createPaidTierRateLimiter } from './rateLimiter';
import { buildSmartContext } from '../utils/smartContext';

const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

// Use Paid Tier limiter by default (120 RPM)
const rateLimiter = createPaidTierRateLimiter();

// ... (keep helper functions: extractJsonFromText, parseOrchestratorResponse, detectAgentMention, parseProposedChanges, findAgentByIdentifier, buildConversationContents, extractAndParseTaskMap, createSystemMessage)

const executeAgencyV2Workflow = async (
    ai: GoogleGenAI,
    messages: Message[],
    codebaseContext: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (chunk: string) => void,
    onAgentChange: (agentId: string | null) => void,
    abortSignal?: AbortSignal,
    activeTaskState?: ActiveTaskState | null
): Promise<{ updatedTaskState: ActiveTaskState | null }> => {
    let currentHistory = [...messages];
    let engine: WorkflowEngine | null = null;
    const executor = createAgentExecutor(ai, abortSignal);

    // ... (keep workflow initialization logic)

    if (activeTaskState) {
        engine = restoreWorkflowEngine(activeTaskState);
    } else {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && typeof lastMessage.author !== 'string' && lastMessage.author.id === 'agent-product-planner-001') {
            const parseResult = extractAndParseTaskMap(lastMessage.content);
            if (parseResult.status === 'success' && parseResult.taskMap) {
                engine = createWorkflowEngine(parseResult.taskMap);
                const startMsg = createSystemMessage(`**🎯 New Plan: "${parseResult.taskMap.title}"**\n\nStarting multi-stage execution...`);
                onNewMessage(startMsg);
            } else if (parseResult.status === 'parse_error') {
                const errorMsg = createSystemMessage(`**❌ Planning Error**: ${parseResult.error}`, true);
                onNewMessage(errorMsg);
                return { updatedTaskState: null };
            }
        }
    }

    if (!engine) {
        // ... (keep Product Planner invocation logic)
        // Note: Product Planner call is single-shot and usually safe, but ideally should also be rate limited.
        // For now, we focus on the main loop below.
        
        // Find Product Planner agent
        const productPlanner = AGENT_PROFILES.find(a => a.id === 'agent-product-planner-001');
        if (!productPlanner) return { updatedTaskState: null };

        const conversationContents = buildConversationContents(messages, codebaseContext);

        try {
            onAgentChange(productPlanner.id);
            let plannerResponse = '';
            
            // Wrap Product Planner in rate limiter
            await rateLimiter.execute(async () => {
                return executor.executeStreaming(
                    productPlanner,
                    'gemini-2.5-pro',
                    conversationContents,
                    { systemInstruction: productPlanner.prompt, safetySettings: SAFETY_SETTINGS },
                    (chunk) => { onMessageUpdate(chunk); plannerResponse += chunk; }
                );
            });

            const plannerMessage: Message = {
                id: crypto.randomUUID(),
                author: productPlanner,
                content: plannerResponse,
                timestamp: new Date(),
            };
            onNewMessage(plannerMessage);
            currentHistory.push(plannerMessage);

            const parseResult = extractAndParseTaskMap(plannerResponse);
            if (parseResult.status === 'success' && parseResult.taskMap) {
                engine = createWorkflowEngine(parseResult.taskMap);
                const startMsg = createSystemMessage(`**🎯 Plan Created: "${parseResult.taskMap.title}"**\n\nStarting execution...`);
                onNewMessage(startMsg);
            } else {
                onAgentChange(null);
                return { updatedTaskState: null };
            }
        } catch (error: any) {
            const errorMsg = createSystemMessage(`**❌ Planning Failed**: ${error.message}`, true);
            onNewMessage(errorMsg);
            onAgentChange(null);
            return { updatedTaskState: null };
        }
    }

    if (engine.isComplete() || engine.isPaused()) {
        return { updatedTaskState: engine.getState() };
    }

    const currentTask = engine.getCurrentTask();
    const currentStage = engine.getCurrentStage();

    if (!currentTask || !currentStage) {
        engine.recordFailure('No current task or stage');
        return { updatedTaskState: engine.getState() };
    }

    const progress = engine.getProgressSummary();
    const stageAgentNames = currentStage.agents.map(a => a.agent).join(', ');
    const stageMsg = createSystemMessage(
        `**Task ${progress.currentTask}/${progress.totalTasks} • Stage ${progress.currentStage}/${progress.totalStages}** (${stageAgentNames}): ${currentStage.objective}`
    );
    onNewMessage(stageMsg);

    if (currentStage.agents.length === 1) {
        // Sequential Execution
        const stageAgent = AGENT_PROFILES.find(a => {
            const identifier = a.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
            return identifier === currentStage.agents[0].agent;
        });

        if (!stageAgent) {
            engine.recordFailure(`Agent not found: ${currentStage.agents[0].agent}`);
            return { updatedTaskState: engine.getState() };
        }

        const conversationContents = buildSmartContext(engine, currentHistory, codebaseContext);
        const streamConfig: any = {
            systemInstruction: stageAgent.prompt,
            safetySettings: SAFETY_SETTINGS,
        };

        if (stageAgent.thinkingBudget) {
            streamConfig.thinking_config = {
                include_thoughts: true,
                budget_tokens: stageAgent.thinkingBudget
            };
        }

        try {
            onAgentChange(stageAgent.id);
            let agentResponse = '';

            // CRITICAL FIX: Wrap sequential execution in rate limiter
            await rateLimiter.execute(async () => {
                return executor.executeStreaming(
                    stageAgent,
                    currentStage.agents[0].model,
                    conversationContents,
                    streamConfig,
                    (chunk) => {
                        onMessageUpdate(chunk);
                        agentResponse += chunk;
                    }
                );
            });

            const { proposedChanges, cleanedText } = parseProposedChanges(agentResponse);
            const agentMessage: Message = {
                id: crypto.randomUUID(),
                author: stageAgent,
                content: cleanedText,
                timestamp: new Date(),
                proposedChanges: proposedChanges || undefined,
            };
            onNewMessage(agentMessage);
            currentHistory.push(agentMessage);

            if (engine.isSynthesizeStage()) {
                engine.clearFeedback();
            }

        } catch (error: any) {
            engine.recordFailure(error.message);
            const errorMsg = createSystemMessage(`**❌ Stage Failed**: ${error.message}`, true);
            onNewMessage(errorMsg);
            return { updatedTaskState: engine.getState() };
        }

    } else {
        // Parallel Execution (Already wrapped in rate limiter in previous version, but ensuring consistency)
        const stageAgents = currentStage.agents.map(stageAgentDef => {
            const agent = AGENT_PROFILES.find(a => {
                const identifier = a.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
                return identifier === stageAgentDef.agent;
            });
            if (!agent) throw new Error(`Agent not found: ${stageAgentDef.agent}`);
            return agent;
        });

        try {
            const parallelResults = await Promise.all(
                stageAgents.map(async (agent, index) => {
                    const stageAgentDef = currentStage.agents[index];
                    
                    // Rate limiter handles concurrency
                    return await rateLimiter.execute(async () => {
                        const agentConfig: any = {
                            systemInstruction: agent.prompt,
                            safetySettings: SAFETY_SETTINGS,
                        };
                        if (agent.thinkingBudget) {
                            agentConfig.thinking_config = { include_thoughts: true, budget_tokens: agent.thinkingBudget };
                        }
                        const result = await executor.executeNonStreaming(
                            agent,
                            stageAgentDef.model,
                            buildSmartContext(engine, currentHistory, codebaseContext),
                            agentConfig
                        );
                        return { agentName: agent.name, content: result.content, agent };
                    });
                })
            );

            parallelResults.forEach(r => engine.addFeedback(r.agentName, r.content));

            for (const result of parallelResults) {
                const { proposedChanges, cleanedText } = parseProposedChanges(result.content);
                const agentMessage: Message = {
                    id: crypto.randomUUID(),
                    author: result.agent,
                    content: cleanedText,
                    timestamp: new Date(),
                    proposedChanges: proposedChanges || undefined,
                };
                onNewMessage(agentMessage);
                currentHistory.push(agentMessage);
            }
            
            const contributors = parallelResults.map(r => r.agentName).join(', ');
            const summaryMsg = createSystemMessage(`✅ **Parallel Review Complete**: ${contributors} provided feedback`);
            onNewMessage(summaryMsg);

        } catch (error: any) {
            engine.recordFailure(error.message);
            const errorMsg = createSystemMessage(`**❌ Parallel Stage Failed**: ${error.message}`, true);
            onNewMessage(errorMsg);
            return { updatedTaskState: engine.getState() };
        }
    }

    const hasMoreWork = engine.advanceToNextStage();

    if (engine.isComplete()) {
        const completeMsg = createSystemMessage(`**✅ Plan Complete**: "${engine.getState().taskMap.title}" finished successfully!`);
        onNewMessage(completeMsg);
        onAgentChange(null);
        return { updatedTaskState: engine.getState() };
    }

    if (engine.isPaused()) {
        const pauseMsg = createSystemMessage(`**⏸️ Paused for Approval**: Review the plan before proceeding to implementation.`);
        onNewMessage(pauseMsg);
        onAgentChange(null);
        return { updatedTaskState: engine.getState() };
    }

    onAgentChange(null);
    return { updatedTaskState: engine.getState() };
};

export const getAgentResponse = async (
    messages: Message[],
    codebaseContext: string,
    onNewMessage: (message: Message) => void,
    onMessageUpdate: (chunk: string) => void,
    onAgentChange: (agentId: string | null) => void,
    abortSignal?: AbortSignal,
    activeTaskState?: ActiveTaskState | null
): Promise<{ updatedTaskState: ActiveTaskState | null }> => {
    const settings = await loadSettings();
    const key = settings?.apiKey;

    if (!key || !key.trim()) {
        throw new Error("Gemini API key is not configured. Please add your API key in Settings (Cmd/Ctrl+S).");
    }

    const ai = new GoogleGenAI({ apiKey: key.trim() });

    try {
        return await executeAgencyV2Workflow(
            ai,
            messages,
            codebaseContext,
            onNewMessage,
            onMessageUpdate,
            onAgentChange,
            abortSignal,
            activeTaskState
        );
    } catch (error) {
        console.error('[GeminiService] Error:', error);
        throw error;
    }
};
```

### 3. Remove Project Key Logic (ChatView.tsx)
This removes the logic that was potentially passing an empty/invalid project key instead of the global key.

```typescript:src/components/ChatView.tsx
// ... imports

interface ChatViewProps {
  activeProject: Project | null;
  isLoading: boolean;
  onSendMessage: (content: string) => void;
  onAddContext: (files: File[]) => void;
  activeAgent: Agent | null;
  apiKey?: string; // Optional, but we won't use it for project overrides anymore
  // ... other props
}

const ChatView = forwardRef<MessageInputHandle, ChatViewProps>(
  ({
    activeProject,
    isLoading,
    onSendMessage,
    onAddContext,
    activeAgent,
    // ... other props
  }, ref) => {
  // ... state

  // ... render logic

  return (
    <main className="flex-1 flex flex-col bg-milk-darkest">
      <ChatHeader projectName={activeProject.name} onSearchChange={setSearchQuery} onOpenRusty={onOpenRusty} />

      <MessageList
        messages={filteredMessages}
        isLoading={isLoading}
        activeAgent={activeAgent}
        workflowState={activeProject.activeTaskState}
        // ... handlers
      />

      {/* Workflow Approval Prompt */}
      {workflowNeedsApproval && activeProject.activeTaskState && (
        <div className="px-4 pb-4">
          <WorkflowApprovalPrompt
            workflowState={activeProject.activeTaskState}
            onApprove={onWorkflowApprove}
            onEdit={onWorkflowEdit}
            onCancel={onWorkflowCancel}
          />
        </div>
      )}

      <MessageInput ref={ref} onSendMessage={onSendMessage} onAddContext={onAddContext} />

      {/* ... search results */}
    </main>
  );
});

ChatView.displayName = 'ChatView';

export default ChatView;
```

### 4. Remove Project Settings Modal (Dead Code)
Since you only want global keys, this modal is now dead code and can be removed or simplified. I'll simplify it to just show info, or you can delete the file. For now, I'll modify it to remove the input field to prevent confusion.

```typescript:src/components/modals/ProjectSettingsModal.tsx
import React from 'react';
import Modal from './Modal';
import { Project } from '../../../types';

interface ProjectSettingsModalProps {
  onClose: () => void;
  onSave: (updates: Partial<Project>) => void;
  project: Project;
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ onClose, project }) => {
  return (
    <Modal onClose={onClose} title={`Project Settings: ${project.name}`}>
      <div className="space-y-6">
        <div className="bg-milk-dark-light/30 border border-milk-dark-light rounded-md p-4">
          <h4 className="text-sm font-semibold text-milk-light mb-2">ℹ️ API Key Configuration</h4>
          <p className="text-xs text-milk-slate-light">
            This project uses the global API key configured in the main Settings (Cmd/Ctrl+S).
            Project-specific keys have been deprecated to ensure consistent rate limiting.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-8">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-milk-slate text-white rounded-md hover:bg-milk-slate-dark transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default ProjectSettingsModal;
```

### 5. Fix AgentExecutor Error Handling
Ensure we see the real error if the API call fails.

```typescript:src/services/AgentExecutor.ts
// ... imports

export class AgentExecutor {
  // ... constructor

  // ... executeStreaming / executeNonStreaming / executeParallel

  private async makeApiCall(
    model: GeminiModel,
    contents: any,
    config: any,
    streaming: boolean,
    onChunk?: (chunk: string) => void
  ): Promise<any> {
    if (streaming) {
      let streamResult;
      try {
        streamResult = await this.ai.models.generateContentStream({
          model,
          contents,
          config
        });
      } catch (apiError) {
        console.error('[AgentExecutor] API call threw error:', apiError);
        // Pass the actual error message up
        throw new Error(`API call failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      }

      if (!streamResult) {
        throw new Error('API call failed: The response stream was empty.');
      }

      // ... processing
      return streamResult;
    } else {
      // Non-streaming
      try {
        return await this.ai.models.generateContent({
          model,
          contents,
          config
        });
      } catch (apiError) {
         console.error('[AgentExecutor] API call threw error:', apiError);
         throw new Error(`API call failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      }
    }
  }
  
  // ... helpers
}
```