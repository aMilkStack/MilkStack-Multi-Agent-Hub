# Rusty Ultimate Roadmap - Part 3: MCP & Implementation

**Document Version:** 1.0  
**Created:** 2025-11-24  
**Part:** 3 of 3  
**Continues from:** [Part 2 - Component Specifications](./rusty_ultimate_roadmap_part2.md)

---

## 4. MCP Tool Framework

**File:** `src/services/enhanced-rusty/integrations/MCPToolFramework.ts`

```typescript
/**
 * MCP (Model Context Protocol) Tool Framework
 * 
 * Provides discovery, execution, and management of MCP tools.
 * Enables Rusty to use external capabilities like file operations,
 * database queries, API calls, etc.
 * 
 * Based on: @modelcontextprotocol/sdk
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  MCPTool,
  MCPServer,
  MCPServerConfig,
  ToolParams,
  ToolResult,
  ToolError,
} from '../../../types/mcp-framework';

export class MCPToolFramework {
  private servers: Map<string, MCPServer> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private clients: Map<string, Client> = new Map();
  
  /**
   * Discover available tools from all registered servers
   */
  async discoverTools(): Promise<MCPTool[]> {
    const allTools: MCPTool[] = [];
    
    for (const [serverName, server] of this.servers.entries()) {
      try {
        const client = this.clients.get(serverName);
        if (!client) continue;
        
        const response = await client.listTools();
        
        response.tools.forEach(tool => {
          const mcpTool: MCPTool = {
            name: tool.name,
            description: tool.description || '',
            serverName,
            inputSchema: tool.inputSchema,
          };
          
          this.tools.set(tool.name, mcpTool);
          allTools.push(mcpTool);
        });
      } catch (error) {
        console.error(`Failed to discover tools from ${serverName}:`, error);
      }
    }
    
    return allTools;
  }
  
  /**
   * Register a new MCP server
   */
  async registerServer(config: MCPServerConfig): Promise<void> {
    try {
      // Create transport for server
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: config.env,
      });
      
      // Create MCP client
      const client = new Client({
        name: 'rusty-ultimate',
        version: '1.0.0',
      }, {
        capabilities: {},
      });
      
      // Connect to server
      await client.connect(transport);
      
      const server: MCPServer = {
        name: config.name,
        config,
        status: 'connected',
        connectedAt: new Date(),
      };
      
      this.servers.set(config.name, server);
      this.clients.set(config.name, client);
      
      // Discover tools from this server
      await this.discoverTools();
      
    } catch (error) {
      throw new Error(`Server registration failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Invoke a tool with given parameters
   */
  async invokeTool(
    toolName: string,
    params: ToolParams
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }
    
    const client = this.clients.get(tool.serverName);
    if (!client) {
      throw new Error(`Server ${tool.serverName} not connected`);
    }
    
    try {
      const response = await client.callTool({
        name: toolName,
        arguments: params,
      });
      
      return {
        success: true,
        toolName,
        result: response.content,
        isError: response.isError || false,
      };
    } catch (error) {
      return {
        success: false,
        toolName,
        error: (error as Error).message,
        isError: true,
      };
    }
  }
  
  /**
   * Execute tool with automatic retry logic
   */
  async executeToolWithRetry(
    toolName: string,
    params: ToolParams,
    maxRetries: number = 3
  ): Promise<ToolResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.invokeTool(toolName, params);
        
        if (result.success) {
          return result;
        }
        
        // If result indicates error, retry
        lastError = new Error(result.error || 'Tool execution failed');
        
        // Exponential backoff
        if (attempt < maxRetries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries - 1) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw new Error(
      `Tool execution failed after ${maxRetries} attempts: ${lastError?.message}`
    );
  }
  
  /**
   * Handle tool execution errors
   */
  async handleToolError(error: ToolError): Promise<ErrorResolution> {
    // Analyze error and determine resolution strategy
    if (error.type === 'connection') {
      // Try to reconnect server
      return {
        strategy: 'reconnect',
        message: 'Attempting to reconnect to MCP server',
      };
    } else if (error.type === 'timeout') {
      // Retry with longer timeout
      return {
        strategy: 'retry',
        message: 'Retrying with extended timeout',
        params: { timeout: error.timeout * 2 },
      };
    } else if (error.type === 'invalid_params') {
      // Return error to user for correction
      return {
        strategy: 'user_correction',
        message: 'Invalid parameters - user correction needed',
        validationErrors: error.validationErrors,
      };
    } else {
      // Unknown error - escalate
      return {
        strategy: 'escalate',
        message: 'Unknown error - manual intervention required',
      };
    }
  }
  
  /**
   * List all available MCP servers
   */
  listAvailableServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }
  
  /**
   * Get specific tool information
   */
  getTool(toolName: string): MCPTool | undefined {
    return this.tools.get(toolName);
  }
  
  /**
   * Check server health
   */
  async checkServerHealth(serverName: string): Promise<boolean> {
    const client = this.clients.get(serverName);
    if (!client) return false;
    
    try {
      await client.listTools();
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Disconnect from a server
   */
  async disconnectServer(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (client) {
      await client.close();
      this.clients.delete(serverName);
    }
    
    this.servers.delete(serverName);
    
    // Remove tools from this server
    for (const [toolName, tool] of this.tools.entries()) {
      if (tool.serverName === serverName) {
        this.tools.delete(toolName);
      }
    }
  }
  
  // Private helper methods
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export interface ErrorResolution {
  strategy: 'reconnect' | 'retry' | 'user_correction' | 'escalate';
  message: string;
  params?: Record<string, unknown>;
  validationErrors?: string[];
}

/**
 * Example MCP Server Configurations
 */
export const DEFAULT_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'filesystem',
    description: 'File system operations',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()],
  },
  {
    name: 'github',
    description: 'GitHub API integration',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_TOKEN: process.env.VITE_GITHUB_TOKEN || '',
    },
  },
];
```

---

## 5. Multi-AI Coordination Service

**File:** `src/services/enhanced-rusty/integrations/MultiAICoordinator.ts`

```typescript
/**
 * Multi-AI Coordination Service
 * 
 * Routes tasks between Gemini agents and external Claude based on:
 * - Task complexity and requirements
 * - AI capabilities and specializations
 * - Cost optimization
 * - Performance tracking
 */

import { ClaudeCodeService } from '../../claudeCodeService';
import { geminiService } from '../../geminiService';
import type {
  Task,
  AISystem,
  AIAssignment,
  SharedContext,
  Suggestion,
  ResolvedSuggestion,
  Agent,
  AIPerformanceMetrics,
} from '../../../types/multi-ai';

export class MultiAICoordinator {
  private claudeService: ClaudeCodeService | null = null;
  private performanceMetrics: Map<AISystem, AIPerformanceMetrics> = new Map();
  
  constructor(claudeApiKey?: string) {
    if (claudeApiKey) {
      this.claudeService = new ClaudeCodeService(claudeApiKey, {
        model: 'claude-sonnet-4-20250514',
      });
    }
    
    this.initializeMetrics();
  }
  
  /**
   * Route task to optimal AI system
   * 
   * Decision factors:
   * 1. Task complexity (simple → Gemini, complex → Claude)
   * 2. Task scope (targeted → Gemini, architectural → Claude)
   * 3. Speed requirements (fast → Gemini Flash, thorough → Claude)
   * 4. Cost considerations (90% Gemini, 10% Claude)
   */
  async routeTask(task: Task): Promise<AIAssignment> {
    // Analyze task requirements
    const requirements = this.analyzeTaskRequirements(task);
    
    // Determine optimal AI system
    const aiSystem = this.selectOptimalAI(requirements);
    
    // Track routing decision
    this.trackRoutingDecision(task, aiSystem, requirements);
    
    return {
      task,
      aiSystem,
      rationale: this.explainRoutingDecision(requirements, aiSystem),
      estimatedCost: this.estimateCost(aiSystem, task),
      estimatedTime: this.estimateTime(aiSystem, task),
    };
  }
  
  /**
   * Execute task on assigned AI system
   */
  async executeTask(assignment: AIAssignment): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      let result: TaskResult;
      
      if (assignment.aiSystem === AISystem.Claude) {
        result = await this.executeOnClaude(assignment.task);
      } else if (assignment.aiSystem === AISystem.Gemini) {
        result = await this.executeOnGemini(assignment.task);
      } else {
        result = await this.executeOnRustyInternal(assignment.task);
      }
      
      // Update performance metrics
      this.updatePerformanceMetrics(
        assignment.aiSystem,
        Date.now() - startTime,
        result.success
      );
      
      return result;
    } catch (error) {
      this.updatePerformanceMetrics(
        assignment.aiSystem,
        Date.now() - startTime,
        false
      );
      throw error;
    }
  }
  
  /**
   * Synchronize context across AI systems
   * 
   * Ensures both Gemini and Claude have same understanding of codebase.
   */
  async synchronizeContext(agents: Agent[]): Promise<SharedContext> {
    const context: SharedContext = {
      codebaseState: await this.getCurrentCodebaseState(),
      recentChanges: await this.getRecentChanges(),
      activeIssues: await this.getActiveIssues(),
      agentStates: agents.map(agent => ({
        agentId: agent.id,
        lastAction: agent.lastAction,
        context: agent.context,
      })),
      timestamp: new Date(),
    };
    
    // Share context with Claude if available
    if (this.claudeService) {
      await this.shareContextWithClaude(context);
    }
    
    return context;
  }
  
  /**
   * Resolve conflicts between competing suggestions
   * 
   * When both Gemini and Claude suggest different approaches,
   * this method resolves the conflict.
   */
  async resolveConflicts(suggestions: Suggestion[]): Promise<ResolvedSuggestion> {
    if (suggestions.length === 0) {
      throw new Error('No suggestions to resolve');
    }
    
    if (suggestions.length === 1) {
      return {
        selectedSuggestion: suggestions[0],
        rationale: 'Only one suggestion available',
        confidence: 1.0,
      };
    }
    
    // Analyze each suggestion
    const analyses = await Promise.all(
      suggestions.map(s => this.analyzeSuggestion(s))
    );
    
    // Score suggestions based on multiple criteria
    const scores = analyses.map((analysis, i) => ({
      suggestion: suggestions[i],
      score: this.scoreSuggestion(analysis),
      analysis,
    }));
    
    // Sort by score
    scores.sort((a, b) => b.score - a.score);
    
    const winner = scores[0];
    
    return {
      selectedSuggestion: winner.suggestion,
      rationale: this.explainResolution(winner.analysis, scores),
      confidence: winner.score / 100,
      alternativeSuggestions: scores.slice(1).map(s => s.suggestion),
    };
  }
  
  /**
   * Get performance metrics for AI systems
   */
  getPerformanceMetrics(): Map<AISystem, AIPerformanceMetrics> {
    return new Map(this.performanceMetrics);
  }
  
  // Private helper methods
  
  private analyzeTaskRequirements(task: Task): TaskRequirements {
    return {
      complexity: this.assessComplexity(task),
      scope: this.assessScope(task),
      requiresDeepReasoning: this.requiresDeepReasoning(task),
      requiresSpeed: this.requiresSpeed(task),
      requiresCodeGeneration: task.type === 'code_generation',
      requiresArchitecturalThinking: task.scope === 'architectural',
    };
  }
  
  private selectOptimalAI(requirements: TaskRequirements): AISystem {
    // Route complex architectural tasks to Claude
    if (requirements.requiresArchitecturalThinking || requirements.requiresDeepReasoning) {
      return AISystem.Claude;
    }
    
    // Route rapid iteration tasks to Gemini
    if (requirements.requiresSpeed || requirements.scope === 'targeted') {
      return AISystem.Gemini;
    }
    
    // For high complexity, prefer Claude if available
    if (requirements.complexity === 'high' && this.claudeService) {
      return AISystem.Claude;
    }
    
    // Default to Gemini for cost efficiency
    return AISystem.Gemini;
  }
  
  private async executeOnClaude(task: Task): Promise<TaskResult> {
    if (!this.claudeService) {
      throw new Error('Claude service not available');
    }
    
    // Use Claude for task execution
    const analysis = await this.claudeService.analyzeCodebase({
      userQuery: task.description,
      codebaseContext: task.context || '',
      focusAreas: task.focusAreas,
    });
    
    return {
      success: true,
      aiSystem: AISystem.Claude,
      result: analysis.content,
      metadata: {
        tokensUsed: analysis.usage.inputTokens + analysis.usage.outputTokens,
        cost: analysis.usage.totalCost,
      },
    };
  }
  
  private async executeOnGemini(task: Task): Promise<TaskResult> {
    // Use Gemini service for task execution
    // This would integrate with existing geminiService
    return {
      success: true,
      aiSystem: AISystem.Gemini,
      result: 'Gemini execution result',
      metadata: {
        tokensUsed: 0,
        cost: 0,
      },
    };
  }
  
  private async executeOnRustyInternal(task: Task): Promise<TaskResult> {
    // Use Rusty's own capabilities
    return {
      success: true,
      aiSystem: AISystem.RustyInternal,
      result: 'Rusty internal execution result',
      metadata: {
        tokensUsed: 0,
        cost: 0,
      },
    };
  }
  
  private assessComplexity(task: Task): 'low' | 'medium' | 'high' {
    // Analyze task description to determine complexity
    const indicators = {
      refactoring: 2,
      architectural: 3,
      bug_fix: 1,
      feature: 2,
      optimization: 2,
    };
    
    const score = indicators[task.type] || 1;
    
    if (score >= 3) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }
  
  private assessScope(task: Task): 'targeted' | 'comprehensive' | 'architectural' {
    return task.scope || 'targeted';
  }
  
  private requiresDeepReasoning(task: Task): boolean {
    const deepReasoningKeywords = [
      'architecture',
      'design pattern',
      'refactor',
      'optimize',
      'security',
    ];
    
    return deepReasoningKeywords.some(keyword =>
      task.description.toLowerCase().includes(keyword)
    );
  }
  
  private requiresSpeed(task: Task): boolean {
    return task.priority === 'urgent' || task.type === 'bug_fix';
  }
  
  private explainRoutingDecision(
    requirements: TaskRequirements,
    aiSystem: AISystem
  ): string {
    const reasons: string[] = [];
    
    if (aiSystem === AISystem.Claude) {
      if (requirements.requiresArchitecturalThinking) {
        reasons.push('requires architectural thinking');
      }
      if (requirements.requiresDeepReasoning) {
        reasons.push('requires deep reasoning');
      }
      if (requirements.complexity === 'high') {
        reasons.push('high complexity task');
      }
    } else if (aiSystem === AISystem.Gemini) {
      if (requirements.requiresSpeed) {
        reasons.push('speed requirement');
      }
      if (requirements.scope === 'targeted') {
        reasons.push('targeted scope');
      }
      reasons.push('cost optimization');
    }
    
    return `Routed to ${aiSystem}: ${reasons.join(', ')}`;
  }
  
  private estimateCost(aiSystem: AISystem, task: Task): number {
    // Rough cost estimates
    const baseCosts = {
      [AISystem.Claude]: 0.015, // $0.015 per request (estimated)
      [AISystem.Gemini]: 0.001, // $0.001 per request (estimated)
      [AISystem.RustyInternal]: 0,
    };
    
    return baseCosts[aiSystem] || 0;
  }
  
  private estimateTime(aiSystem: AISystem, task: Task): number {
    // Rough time estimates in milliseconds
    const baseTimes = {
      [AISystem.Claude]: 5000, // 5 seconds
      [AISystem.Gemini]: 2000, // 2 seconds
      [AISystem.RustyInternal]: 1000, // 1 second
    };
    
    return baseTimes[aiSystem] || 3000;
  }
  
  private async analyzeSuggestion(suggestion: Suggestion): Promise<SuggestionAnalysis> {
    return {
      suggestion,
      feasibility: this.assessFeasibility(suggestion),
      impact: this.assessImpact(suggestion),
      risk: this.assessRisk(suggestion),
      alignment: this.assessAlignment(suggestion),
    };
  }
  
  private scoreSuggestion(analysis: SuggestionAnalysis): number {
    let score = 0;
    
    // Weight factors
    score += analysis.feasibility * 30;
    score += analysis.impact * 25;
    score += (100 - analysis.risk) * 25;
    score += analysis.alignment * 20;
    
    return Math.min(score, 100);
  }
  
  private explainResolution(
    winnerAnalysis: SuggestionAnalysis,
    allScores: Array<{ suggestion: Suggestion; score: number; analysis: SuggestionAnalysis }>
  ): string {
    const winner = allScores[0];
    const reasons: string[] = [];
    
    if (winner.analysis.feasibility > 80) {
      reasons.push('highly feasible');
    }
    if (winner.analysis.impact > 80) {
      reasons.push('high impact');
    }
    if (winner.analysis.risk < 30) {
      reasons.push('low risk');
    }
    if (winner.analysis.alignment > 80) {
      reasons.push('well aligned with goals');
    }
    
    return `Selected based on: ${reasons.join(', ')} (score: ${winner.score}/100)`;
  }
  
  private assessFeasibility(suggestion: Suggestion): number {
    // Assess how feasible the suggestion is to implement
    return 75; // Placeholder
  }
  
  private assessImpact(suggestion: Suggestion): number {
    // Assess the positive impact of the suggestion
    return 80; // Placeholder
  }
  
  private assessRisk(suggestion: Suggestion): number {
    // Assess the risk of implementing the suggestion
    return 20; // Placeholder
  }
  
  private assessAlignment(suggestion: Suggestion): number {
    // Assess alignment with project goals
    return 85; // Placeholder
  }
  
  private initializeMetrics(): void {
    for (const system of Object.values(AISystem)) {
      this.performanceMetrics.set(system, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        totalCost: 0,
      });
    }
  }
  
  private trackRoutingDecision(
    task: Task,
    aiSystem: AISystem,
    requirements: TaskRequirements
  ): void {
    // Log routing decision for analytics
    console.log(`[MultiAI] Routing ${task.type} task to ${aiSystem}`, requirements);
  }
  
  private updatePerformanceMetrics(
    aiSystem: AISystem,
    responseTime: number,
    success: boolean
  ): void {
    const metrics = this.performanceMetrics.get(aiSystem);
    if (!metrics) return;
    
    metrics.totalRequests++;
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }
    
    // Update average response time
    metrics.averageResponseTime =
      (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) /
      metrics.totalRequests;
  }
  
  private async getCurrentCodebaseState(): Promise<CodebaseState> {
    // Get current codebase state
    return {
      files: [],
      lastModified: new Date(),
    };
  }
  
  private async getRecentChanges(): Promise<Change[]> {
    // Get recent code changes
    return [];
  }
  
  private async getActiveIssues(): Promise<Issue[]> {
    // Get active issues/bugs
    return [];
  }
  
  private async shareContextWithClaude(context: SharedContext): Promise<void> {
    // Share context with Claude service
    // This would be used for coordination
  }
}

interface TaskRequirements {
  complexity: 'low' | 'medium' | 'high';
  scope: 'targeted' | 'comprehensive' | 'architectural';
  requiresDeepReasoning: boolean;
  requiresSpeed: boolean;
  requiresCodeGeneration: boolean;
  requiresArchitecturalThinking: boolean;
}

interface TaskResult {
  success: boolean;
  aiSystem: AISystem;
  result: string;
  metadata: {
    tokensUsed: number;
    cost: number;
  };
}

interface SuggestionAnalysis {
  suggestion: Suggestion;
  feasibility: number; // 0-100
  impact: number; // 0-100
  risk: number; // 0-100
  alignment: number; // 0-100
}

interface CodebaseState {
  files: string[];
  lastModified: Date;
}

interface Change {
  file: string;
  type: 'create' | 'modify' | 'delete';
  timestamp: Date;
}

interface Issue {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (P0) - Weeks 1-2

**Goal:** Establish foundation for Enhanced Rusty Ultimate

**Tasks:**

1. **Directory Structure Setup**
   ```bash
   mkdir -p src/services/enhanced-rusty/{core,workflows,integrations,ui}
   mkdir -p src/types/enhanced-rusty
   ```
   - Create complete folder structure
   - Set up module exports
   - Configure TypeScript paths

2. **EnhancedRustyCore Service** (3-4 days)
   - Implement `EnhancedRustyCore.ts`
   - Implement `CodeAnalysisEngine.ts`
   - Implement `ChangeValidator.ts`
   - Write unit tests for core logic

3. **Audit Trail System** (2 days)
   - Implement `AuditLogger` class
   - Add IndexedDB persistence for audit logs
   - Create audit log viewer UI component

4. **Type Definitions** (1-2 days)
   - Define all TypeScript interfaces in `types/enhanced-rusty`
   - Ensure type safety across all components
   - Document type usage

5. **Testing & Validation** (2 days)
   - Write comprehensive tests
   - Test with existing rustyPortableService
   - Ensure no breaking changes

**Deliverables:**
- ✅ Working EnhancedRustyCore service
- ✅ Complete type definitions
- ✅ Audit trail logging system
- ✅ 80%+ test coverage
- ✅ Documentation for core APIs

**Success Criteria:**
- Can analyze codebase and generate proposals
- All tests passing
- No performance regression
- Backward compatible with existing code

---

### Phase 2: Developer Capabilities (P1) - Weeks 3-4

**Goal:** Add code generation, refactoring, and testing capabilities

**Tasks:**

1. **Proposal Generator** (4-5 days)
   - Implement `ProposalGenerator.ts`
   - Add code generation templates
   - Implement diff generation
   - Add validation logic

2. **Refactoring Engine** (3-4 days)
   - Implement AST-based refactoring
   - Add support for common refactorings:
     - Extract function
     - Rename variable
     - Move file
     - Update imports

3. **Test Generation** (2-3 days)
   - Generate unit test templates
   - Generate integration test templates
   - Use existing code patterns for test generation

4. **Debugging Assistance** (2 days)
   - Error pattern recognition
   - Stack trace analysis
   - Fix suggestion generation

5. **Integration with Gemini Agents** (2-3 days)
   - Coordinate with Builder agent
   - Coordinate with Debug Specialist
   - Share context between systems

**Deliverables:**
- ✅ Working proposal generation
- ✅ Refactoring capabilities
- ✅ Test generation system
- ✅ Debugging assistance
- ✅ Gemini agent integration

**Success Criteria:**
- Can generate valid TypeScript/React code
- Refactorings produce correct output
- Tests are runnable and valid
- No conflicts with existing agents

---

### Phase 3: GitHub & MCP Integration (P1-P2) - Weeks 5-6

**Goal:** Add external integrations for GitHub and MCP tools

**Tasks:**

1. **GitHub Integration** (4-5 days)
   - Install and configure Octokit
   - Implement `GitHubIntegrationService.ts`
   - Add branch management
   - Add PR creation
   - Add CI/CD monitoring

2. **MCP Tool Framework** (4-5 days)
   - Install @modelcontextprotocol/sdk
   - Implement `MCPToolFramework.ts`
   - Implement `MCPServerManager.ts`
   - Add tool discovery
   - Add tool execution with retry

3. **Error Recovery** (2 days)
   - Implement error handling for GitHub
   - Implement error handling for MCP
   - Add retry logic with exponential backoff
   - Add fallback mechanisms

4. **Rate Limiting** (1-2 days)
   - Implement rate limiting for GitHub API
   - Implement quota management for MCP
   - Add cost tracking

**Deliverables:**
- ✅ GitHub PR automation
- ✅ MCP tool integration
- ✅ Error recovery systems
- ✅ Rate limiting & quota management

**Success Criteria:**
- Can create PRs automatically
- Can execute MCP tools reliably
- Handles errors gracefully
- Respects rate limits

**Dependencies to Add:**
```json
{
  "dependencies": {
    "@octokit/rest": "^20.0.0",
    "@modelcontextprotocol/sdk": "^0.5.0"
  }
}
```

---

### Phase 4: UI & Approval Workflows (P2) - Weeks 7-8

**Goal:** Build user interface for approval workflow

**Tasks:**

1. **Approval Workflow Logic** (3-4 days)
   - Implement `ApprovalWorkflow.ts`
   - Implement `ExecutionEngine.ts`
   - Implement `RollbackManager.ts`
   - Implement `CheckpointManager.ts`

2. **UI Components** (5-6 days)
   - Create `ApprovalDialog.tsx`
   - Create `ImpactPreview.tsx`
   - Create `ProgressTracker.tsx`
   - Create `ProposalCard.tsx`
   - Style with existing design system

3. **State Management** (2 days)
   - Add approval workflow state to Context
   - Implement useApprovalWorkflow hook
   - Add persistence to IndexedDB

4. **User Testing** (2-3 days)
   - Test approval flows
   - Test rejection flows
   - Test rollback scenarios
   - Gather user feedback

**Deliverables:**
- ✅ Complete approval workflow system
- ✅ Polished UI components
- ✅ State management integration
- ✅ User testing completed

**Success Criteria:**
- Users can review and approve proposals
- Impact preview is clear and helpful
- Rollback works correctly
- UI is intuitive and responsive

---

### Phase 5: Multi-AI Coordination (P2-P3) - Weeks 9-10

**Goal:** Enable coordination between Gemini and Claude

**Tasks:**

1. **Multi-AI Coordinator** (4-5 days)
   - Implement `MultiAICoordinator.ts`
   - Add task routing logic
   - Add context synchronization
   - Add conflict resolution

2. **Performance Tracking** (2 days)
   - Track AI performance metrics
   - Add cost tracking
   - Add response time monitoring
   - Create performance dashboard

3. **Optimization** (2-3 days)
   - Optimize routing decisions
   - Implement caching where appropriate
   - Reduce redundant API calls
   - Improve response times

4. **Integration Testing** (2-3 days)
   - Test Gemini ↔ Claude coordination
   - Test conflict resolution
   - Test context synchronization
   - End-to-end testing

**Deliverables:**
- ✅ Working multi-AI coordination
- ✅ Performance metrics dashboard
- ✅ Optimized routing
- ✅ Complete integration tests

**Success Criteria:**
- Tasks route correctly to optimal AI
- Context stays synchronized
- Conflicts resolve correctly
- Performance is acceptable

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| **Breaking existing multi-agent system** | Medium | Critical | • Extensive integration testing<br>• Feature flags for gradual rollout<br>• Preserve all existing APIs |
| **API quota exceeded** | High | High | • Implement strict rate limiting<br>• Use cost tracking<br>• Maintain 90/10 flash/pro ratio |
| **Rollback failures** | Medium | High | • Comprehensive checkpoint testing<br>• Multiple fallback mechanisms<br>• Manual recovery procedures |
| **GitHub API rate limits** | Medium | Medium | • Implement request batching<br>• Cache GitHub data<br>• Use conditional requests |
| **MCP tool failures** | High | Medium | • Robust error handling<br>• Retry logic with backoff<br>• Graceful degradation |
| **Context window overflow** | Medium | Medium | • Monitor context usage<br>• Implement context compression<br>• Automatic context pruning |

### Safety Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| **Unintended code changes** | Medium | Critical | • ALWAYS require user approval<br>• Show detailed impact preview<br>• Create checkpoints before execution |
| **Data loss from rollback** | Low | Critical | • Test rollback extensively<br>• Backup critical data<br>• Confirmation dialogs |
| **Security vulnerabilities introduced** | Low | High | • Code review all proposals<br>• Security scanning<br>• Conservative risk scoring |
| **Privilege escalation** | Very Low | Critical | • No direct file system access<br>• All operations via controlled APIs<br>• Audit all actions |

### Performance Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| **Slow proposal generation** | Medium | Medium | • Use Gemini Flash for analysis<br>• Implement caching<br>• Parallel processing |
| **UI lag during approval** | Low | Low | • Async processing<br>• Progress indicators<br>• Optimistic updates |
| **IndexedDB bottlenecks** | Low | Medium | • Efficient indexing<br>• Batch operations<br>• Background sync |

---

## Success Criteria

### Functional Success

- ✅ **Code Analysis**: Can analyze entire MilkStack codebase in <30 seconds
- ✅ **Proposal Generation**: Generates valid, actionable proposals
- ✅ **Approval Workflow**: Users can approve/reject with clear understanding
- ✅ **Execution**: Applies approved changes correctly 100% of the time
- ✅ **Rollback**: Rolls back failed changes in <5 seconds
- ✅ **GitHub Integration**: Creates PRs with detailed descriptions
- ✅ **MCP Tools**: Executes tools with 95%+ success rate
- ✅ **Multi-AI**: Routes tasks optimally based on requirements

### Technical Success

- ✅ **Test Coverage**: 80%+ test coverage across all new code
- ✅ **Type Safety**: No `any` types except in controlled scenarios
- ✅ **Performance**: No >10% degradation in existing features
- ✅ **Cost Management**: Maintains 90/10 flash/pro ratio
- ✅ **Error Handling**: All errors caught and handled gracefully
- ✅ **Audit Trail**: 100% of actions logged

### User Experience Success

- ✅ **Clarity**: Users understand what Rusty will do before approval
- ✅ **Control**: Users feel in control of all code changes
- ✅ **Trust**: Users trust Rusty's recommendations
- ✅ **Efficiency**: Reduces manual coding time by 30%+
- ✅ **Learning**: Users learn from Rusty's suggestions

### Business Success

- ✅ **Cost**: Total AI API costs stay within budget
- ✅ **Adoption**: 80%+ of users try Rusty Ultimate features
- ✅ **Retention**: 60%+ of users use it regularly
- ✅ **Value**: Positive feedback from majority of users

---

## Appendix

### Example Usage Flow

```typescript
// 1. Initialize Enhanced Rusty
const rusty = new EnhancedRustyCore(apiKey, {
  safetyLevel: 'conservative',
  model: 'gemini-2.5-pro',
});

// 2. Analyze codebase and generate proposal
const response = await rusty.analyzeAndPropose({
  codebaseContext: codebase,
  userQuery: 'Fix the stale closure issue in App.tsx',
  scope: 'targeted',
  generateProposal: true,
});

if (response.proposal) {
  // 3. Create approval workflow
  const workflow = new ApprovalWorkflow();
  const proposal = await workflow.createProposal(
    response.proposal.changes,
    response.analysis
  );
  
  // 4. Request user approval
  const request = await workflow.requestUserApproval(proposal.id);
  
  // 5. Display impact preview
  const preview = workflow.displayImpactPreview(proposal);
  // ... show in UI ...
  
  // 6. Wait for user decision
  const decision = await workflow.waitForDecision(proposal.id);
  
  if (decision.approved) {
    // 7. Execute approved changes
    const result = await workflow.executeApproved(proposal.id);
    
    if (result.success) {
      // 8. Create GitHub PR
      const github = new GitHubIntegrationService(token, 'owner', 'repo');
      const branch = await github.createFeatureBranch('main', proposal.id);
      const pr = await github.createPullRequest(
        branch.branchName,
        proposal.changes,
        proposal
      );
      
      console.log(`PR created: ${pr.url}`);
    }
  }
}
```

---

**Document Status:** Complete  
**Total Pages:** 3 parts  
**Last Updated:** 2025-11-24

**Part 1:** [Architecture Overview](./rusty_ultimate_roadmap.md)  
**Part 2:** [Component Specifications](./rusty_ultimate_roadmap_part2.md)  
**Part 3:** This document (MCP Framework & Implementation)
