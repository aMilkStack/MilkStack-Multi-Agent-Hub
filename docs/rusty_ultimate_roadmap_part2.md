# Rusty Ultimate Roadmap - Part 2: Component Specifications

**Document Version:** 1.0  
**Created:** 2025-11-24  
**Part:** 2 of 3  
**Continues from:** [Part 1 - Architecture Overview](./rusty_ultimate_roadmap.md)

---

## Component Specifications

### 1. Enhanced Rusty Core Service

**File:** `src/services/enhanced-rusty/core/EnhancedRustyCore.ts`

```typescript
/**
 * Enhanced Rusty Core Service
 * 
 * Provides full developer capabilities with approval-based autonomy.
 * Extends current rustyPortableService.ts functionality.
 */

import { CodeAnalysisEngine } from './CodeAnalysisEngine';
import { ProposalGenerator } from './ProposalGenerator';
import { ChangeValidator } from './ChangeValidator';
import type {
  EnhancedRustyRequest,
  EnhancedRustyResponse,
  CodeAnalysisResult,
  Proposal,
  ValidationResult,
  RuntimeError,
  FileChange,
} from '../../../types/enhanced-rusty';

export class EnhancedRustyCore {
  private analysisEngine: CodeAnalysisEngine;
  private proposalGenerator: ProposalGenerator;
  private validator: ChangeValidator;
  private auditLogger: AuditLogger;
  
  constructor(
    private readonly apiKey: string,
    private readonly options: EnhancedRustyOptions = {}
  ) {
    this.analysisEngine = new CodeAnalysisEngine(apiKey, options);
    this.proposalGenerator = new ProposalGenerator(apiKey, options);
    this.validator = new ChangeValidator(options);
    this.auditLogger = new AuditLogger();
  }
  
  /**
   * Analyze codebase and generate improvement proposal
   * 
   * This is the main entry point for Rusty Ultimate's enhanced capabilities.
   * Unlike the original rustyPortableService which only reports issues,
   * this analyzes AND generates actionable proposals.
   */
  async analyzeAndPropose(
    request: EnhancedRustyRequest
  ): Promise<EnhancedRustyResponse> {
    const startTime = Date.now();
    
    this.auditLogger.logAction('analyze_request', {
      scope: request.scope,
      focusAreas: request.focusAreas,
    });
    
    try {
      // Step 1: Deep code analysis
      const analysis = await this.analysisEngine.analyze({
        codebaseContext: request.codebaseContext,
        focusAreas: request.focusAreas,
        errorContext: request.errorContext,
        userQuery: request.userQuery,
      });
      
      // Step 2: Generate proposal if improvements found
      let proposal: Proposal | null = null;
      if (analysis.issues.length > 0 && request.generateProposal !== false) {
        proposal = await this.proposalGenerator.generate({
          analysis,
          scope: request.scope || 'targeted',
          safetyLevel: request.safetyLevel || 'conservative',
        });
        
        // Step 3: Validate proposal
        if (proposal) {
          const validation = await this.validator.validate(proposal);
          proposal.validationResult = validation;
          
          // Adjust risk score based on validation
          if (!validation.isValid) {
            proposal.riskScore = Math.max(proposal.riskScore, 80);
          }
          
          this.auditLogger.logProposal(proposal);
        }
      }
      
      const response: EnhancedRustyResponse = {
        analysis,
        proposal,
        metadata: {
          timestamp: new Date(),
          modelUsed: this.options.model || 'gemini-2.5-pro',
          analysisTime: Date.now() - startTime,
        },
      };
      
      this.auditLogger.logSuccess('analyze_and_propose', response);
      return response;
      
    } catch (error) {
      this.auditLogger.logError('analyze_and_propose', error as Error);
      throw error;
    }
  }
  
  /**
   * Validate a specific set of changes
   * 
   * Used to validate user-modified proposals or changes from other sources.
   */
  async validateChanges(changes: FileChange[]): Promise<ValidationResult> {
    this.auditLogger.logAction('validate_changes', { 
      fileCount: changes.length 
    });
    
    return await this.validator.validateChanges(changes);
  }
  
  /**
   * Get analysis engine instance for advanced usage
   */
  getAnalysisEngine(): CodeAnalysisEngine {
    return this.analysisEngine;
  }
  
  /**
   * Get audit trail for debugging and compliance
   */
  getAuditTrail(): AuditEntry[] {
    return this.auditLogger.getEntries();
  }
}

export interface EnhancedRustyOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  safetyLevel?: 'aggressive' | 'moderate' | 'conservative';
  autoApproveThreshold?: number; // Risk score below this can auto-approve (default: never)
}

export interface EnhancedRustyRequest {
  codebaseContext: string;
  focusAreas?: string[];
  errorContext?: RuntimeError[];
  userQuery?: string;
  scope?: 'targeted' | 'comprehensive' | 'architectural';
  safetyLevel?: 'aggressive' | 'moderate' | 'conservative';
  generateProposal?: boolean; // Default: true
}

export interface EnhancedRustyResponse {
  analysis: CodeAnalysisResult;
  proposal: Proposal | null;
  metadata: {
    timestamp: Date;
    modelUsed: string;
    analysisTime: number;
  };
}

/**
 * Audit Logger for compliance and debugging
 */
class AuditLogger {
  private entries: AuditEntry[] = [];
  private maxEntries = 10000;
  
  logAction(action: string, details: unknown): void {
    this.addEntry({
      timestamp: new Date(),
      type: 'action',
      action,
      details,
    });
  }
  
  logProposal(proposal: Proposal): void {
    this.addEntry({
      timestamp: new Date(),
      type: 'proposal',
      action: 'proposal_created',
      details: {
        proposalId: proposal.id,
        riskScore: proposal.riskScore,
        changeCount: proposal.changes.length,
      },
    });
  }
  
  logSuccess(action: string, result: unknown): void {
    this.addEntry({
      timestamp: new Date(),
      type: 'success',
      action,
      details: result,
    });
  }
  
  logError(action: string, error: Error): void {
    this.addEntry({
      timestamp: new Date(),
      type: 'error',
      action,
      details: {
        message: error.message,
        stack: error.stack,
      },
    });
  }
  
  private addEntry(entry: AuditEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }
  
  getEntries(): AuditEntry[] {
    return [...this.entries];
  }
}

interface AuditEntry {
  timestamp: Date;
  type: 'action' | 'proposal' | 'success' | 'error';
  action: string;
  details: unknown;
}
```

---

### 2. Approval Workflow System

**File:** `src/services/enhanced-rusty/workflows/ApprovalWorkflow.ts`

```typescript
/**
 * Approval Workflow System
 * 
 * Manages the complete lifecycle of code change proposals:
 * 1. Proposal creation
 * 2. User approval request
 * 3. Impact preview
 * 4. Approval decision
 * 5. Execution or rejection
 */

import { ExecutionEngine } from './ExecutionEngine';
import { RollbackManager } from './RollbackManager';
import { CheckpointManager } from './CheckpointManager';
import type {
  Proposal,
  ApprovalRequest,
  UserDecision,
  ExecutionResult,
  ImpactAnalysis,
  SystemCheckpoint,
} from '../../../types/approval-workflow';

export class ApprovalWorkflow {
  private proposals: Map<string, Proposal> = new Map();
  private approvalRequests: Map<string, ApprovalRequest> = new Map();
  private executionEngine: ExecutionEngine;
  private rollbackManager: RollbackManager;
  private checkpointManager: CheckpointManager;
  private approvalCallbacks: Map<string, (decision: UserDecision) => void> = new Map();
  
  constructor() {
    this.executionEngine = new ExecutionEngine();
    this.rollbackManager = new RollbackManager();
    this.checkpointManager = new CheckpointManager();
  }
  
  /**
   * Create a new proposal from analyzed changes
   */
  async createProposal(
    changes: FileChange[],
    analysis: CodeAnalysisResult
  ): Promise<Proposal> {
    const proposalId = this.generateProposalId();
    
    // Perform impact analysis
    const impactAnalysis = await this.analyzeImpact(changes, analysis);
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(analysis, impactAnalysis);
    
    // Determine if approval is required
    const requiresApproval = this.shouldRequireApproval(riskScore);
    
    const proposal: Proposal = {
      id: proposalId,
      changes,
      description: this.generateDescription(analysis),
      riskScore,
      impactAnalysis,
      requiresApproval,
      createdAt: new Date(),
      status: 'pending',
      analysis,
    };
    
    this.proposals.set(proposalId, proposal);
    
    return proposal;
  }
  
  /**
   * Request user approval for a proposal
   * 
   * Returns immediately with approval request object.
   * Use waitForDecision() to wait for user's decision.
   */
  async requestUserApproval(proposalId: string): Promise<ApprovalRequest> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }
    
    const request: ApprovalRequest = {
      proposalId,
      proposal,
      requestedAt: new Date(),
      status: 'pending',
    };
    
    this.approvalRequests.set(proposalId, request);
    
    return request;
  }
  
  /**
   * Display impact preview to user
   * 
   * This prepares data for the UI to show what will change.
   */
  displayImpactPreview(proposal: Proposal): ImpactPreviewData {
    return {
      proposalId: proposal.id,
      summary: this.generateSummary(proposal),
      changes: proposal.changes.map(change => ({
        file: change.file,
        type: change.type, // 'create' | 'modify' | 'delete'
        linesAdded: change.linesAdded || 0,
        linesRemoved: change.linesRemoved || 0,
        diff: change.diff,
      })),
      impactAnalysis: proposal.impactAnalysis,
      riskScore: proposal.riskScore,
      riskLevel: this.getRiskLevel(proposal.riskScore),
      recommendations: proposal.analysis.improvements.map(i => i.description),
    };
  }
  
  /**
   * Wait for user decision (approve/reject/modify)
   * 
   * This returns a Promise that resolves when user makes a decision.
   * UI components will call recordDecision() to resolve this.
   */
  async waitForDecision(proposalId: string): Promise<UserDecision> {
    return new Promise((resolve) => {
      this.approvalCallbacks.set(proposalId, resolve);
    });
  }
  
  /**
   * Record user's decision
   * 
   * Called by UI when user clicks Approve/Reject/Modify.
   */
  recordDecision(proposalId: string, decision: UserDecision): void {
    const callback = this.approvalCallbacks.get(proposalId);
    if (callback) {
      callback(decision);
      this.approvalCallbacks.delete(proposalId);
    }
    
    const request = this.approvalRequests.get(proposalId);
    if (request) {
      request.status = decision.approved ? 'approved' : 'rejected';
      request.decision = decision;
      request.respondedAt = new Date();
    }
  }
  
  /**
   * Execute approved proposal
   */
  async executeApproved(proposalId: string): Promise<ExecutionResult> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }
    
    const request = this.approvalRequests.get(proposalId);
    if (!request || request.status !== 'approved') {
      throw new Error(`Proposal ${proposalId} not approved`);
    }
    
    // Create checkpoint before execution
    const checkpoint = await this.checkpointManager.createCheckpoint();
    
    try {
      // Execute changes
      proposal.status = 'executing';
      const result = await this.executionEngine.execute(proposal.changes);
      
      if (result.success) {
        proposal.status = 'completed';
        return {
          success: true,
          proposalId,
          filesChanged: result.filesChanged,
          message: 'Proposal executed successfully',
        };
      } else {
        // Partial failure - rollback
        proposal.status = 'failed';
        await this.rollbackManager.rollback(checkpoint);
        return {
          success: false,
          proposalId,
          error: result.error,
          message: 'Execution failed - changes rolled back',
        };
      }
    } catch (error) {
      // Execution error - rollback
      proposal.status = 'failed';
      await this.rollbackManager.rollback(checkpoint);
      throw error;
    }
  }
  
  /**
   * Rollback a failed proposal
   */
  async rollbackFailed(proposalId: string): Promise<RollbackResult> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }
    
    // Get last checkpoint
    const checkpoint = await this.checkpointManager.getLatestCheckpoint();
    if (!checkpoint) {
      throw new Error('No checkpoint available for rollback');
    }
    
    return await this.rollbackManager.rollback(checkpoint);
  }
  
  /**
   * Get proposal by ID
   */
  getProposal(proposalId: string): Proposal | undefined {
    return this.proposals.get(proposalId);
  }
  
  /**
   * Get all pending proposals
   */
  getPendingProposals(): Proposal[] {
    return Array.from(this.proposals.values()).filter(
      p => p.status === 'pending'
    );
  }
  
  // Private helper methods
  
  private generateProposalId(): string {
    return `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async analyzeImpact(
    changes: FileChange[],
    analysis: CodeAnalysisResult
  ): Promise<ImpactAnalysis> {
    const affectedFiles = changes.map(c => c.file);
    const affectedComponents = this.identifyAffectedComponents(affectedFiles);
    const testingRequired = this.shouldRequireTesting(changes);
    
    return {
      affectedFiles,
      affectedComponents,
      breakingChanges: this.identifyBreakingChanges(changes),
      testingRequired,
      estimatedRisk: this.estimateRisk(analysis),
      dependencies: this.findDependencies(affectedFiles),
    };
  }
  
  private calculateRiskScore(
    analysis: CodeAnalysisResult,
    impact: ImpactAnalysis
  ): number {
    let score = 0;
    
    // Base score from analysis
    score += analysis.issues.filter(i => i.severity === 'critical').length * 25;
    score += analysis.issues.filter(i => i.severity === 'high').length * 15;
    score += analysis.issues.filter(i => i.severity === 'medium').length * 5;
    
    // Impact modifiers
    if (impact.breakingChanges.length > 0) score += 20;
    if (impact.affectedComponents.length > 5) score += 10;
    if (impact.testingRequired) score += 10;
    
    return Math.min(score, 100);
  }
  
  private shouldRequireApproval(riskScore: number): boolean {
    // Always require approval for any changes
    // Can be configured with autoApproveThreshold in options
    return true;
  }
  
  private generateDescription(analysis: CodeAnalysisResult): string {
    const issueCount = analysis.issues.length;
    const criticalCount = analysis.issues.filter(i => i.severity === 'critical').length;
    
    if (criticalCount > 0) {
      return `Fix ${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} and ${issueCount - criticalCount} other issue${issueCount - criticalCount > 1 ? 's' : ''}`;
    }
    
    return `Address ${issueCount} code quality issue${issueCount > 1 ? 's' : ''}`;
  }
  
  private generateSummary(proposal: Proposal): string {
    return `${proposal.description}\n\nRisk: ${this.getRiskLevel(proposal.riskScore)} (${proposal.riskScore}/100)\nFiles: ${proposal.changes.length}`;
  }
  
  private getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }
  
  private identifyAffectedComponents(files: string[]): string[] {
    // Analyze which components/modules are affected
    const components = new Set<string>();
    
    files.forEach(file => {
      const parts = file.split('/');
      if (parts.length >= 3) {
        components.add(parts[2]); // e.g., "src/components/ChatView.tsx" -> "ChatView"
      }
    });
    
    return Array.from(components);
  }
  
  private identifyBreakingChanges(changes: FileChange[]): string[] {
    // Identify potentially breaking changes
    const breaking: string[] = [];
    
    changes.forEach(change => {
      // Check for API changes, type modifications, etc.
      if (change.type === 'modify' && change.diff) {
        if (change.diff.includes('export interface') || change.diff.includes('export type')) {
          breaking.push(`Type definition change in ${change.file}`);
        }
        if (change.diff.includes('export function') || change.diff.includes('export const')) {
          breaking.push(`API change in ${change.file}`);
        }
      }
    });
    
    return breaking;
  }
  
  private shouldRequireTesting(changes: FileChange[]): boolean {
    // Determine if changes require testing
    return changes.some(change =>
      change.file.includes('src/services') ||
      change.file.includes('src/utils') ||
      change.type === 'create'
    );
  }
  
  private estimateRisk(analysis: CodeAnalysisResult): 'low' | 'medium' | 'high' | 'critical' {
    return analysis.estimatedImpact;
  }
  
  private findDependencies(files: string[]): string[] {
    // Find files that depend on the changed files
    // This would require AST analysis in a real implementation
    return [];
  }
}

export interface ImpactPreviewData {
  proposalId: string;
  summary: string;
  changes: Array<{
    file: string;
    type: 'create' | 'modify' | 'delete';
    linesAdded: number;
    linesRemoved: number;
    diff?: string;
  }>;
  impactAnalysis: ImpactAnalysis;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface RollbackResult {
  success: boolean;
  message: string;
  filesRestored: string[];
}
```

---

### 3. GitHub Integration Layer

**File:** `src/services/enhanced-rusty/integrations/GitHubIntegration.ts`

```typescript
/**
 * GitHub Integration Layer
 * 
 * Handles all GitHub operations:
 * - Branch creation and management
 * - Pull request generation
 * - CI/CD status monitoring
 * - Merge conflict handling
 */

import { Octokit } from '@octokit/rest';
import type {
  Proposal,
  ExecutionResult,
  FileChange,
  PullRequest,
  BranchResult,
  CIStatus,
} from '../../../types/github-integration';

export class GitHubIntegrationService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  
  constructor(
    token: string,
    owner: string,
    repo: string
  ) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }
  
  /**
   * Create a new feature branch for proposed changes
   */
  async createFeatureBranch(
    baseBranch: string,
    featureName: string
  ): Promise<BranchResult> {
    try {
      // Get latest commit SHA from base branch
      const baseSha = await this.getLatestCommitSha(baseBranch);
      
      // Create new branch
      const branchName = `rusty/${featureName}`;
      const ref = await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });
      
      return {
        success: true,
        branchName,
        ref: ref.data.ref,
        sha: baseSha,
      };
    } catch (error) {
      throw new Error(`Branch creation failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Commit changes to a branch
   */
  async commitChanges(
    branch: string,
    changes: FileChange[],
    message: string
  ): Promise<string> {
    try {
      // Get current tree
      const latestCommit = await this.octokit.repos.getBranch({
        owner: this.owner,
        repo: this.repo,
        branch,
      });
      
      const currentTreeSha = latestCommit.data.commit.commit.tree.sha;
      
      // Create blobs for each changed file
      const blobs = await Promise.all(
        changes.map(async (change) => {
          const blob = await this.octokit.git.createBlob({
            owner: this.owner,
            repo: this.repo,
            content: change.content || '',
            encoding: 'utf-8',
          });
          
          return {
            path: change.file,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.data.sha,
          };
        })
      );
      
      // Create new tree
      const newTree = await this.octokit.git.createTree({
        owner: this.owner,
        repo: this.repo,
        base_tree: currentTreeSha,
        tree: blobs,
      });
      
      // Create commit
      const newCommit = await this.octokit.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message,
        tree: newTree.data.sha,
        parents: [latestCommit.data.commit.sha],
      });
      
      // Update branch reference
      await this.octokit.git.updateRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branch}`,
        sha: newCommit.data.sha,
      });
      
      return newCommit.data.sha;
    } catch (error) {
      throw new Error(`Commit failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Create pull request for approved changes
   */
  async createPullRequest(
    branch: string,
    changes: FileChange[],
    proposal: Proposal
  ): Promise<PullRequest> {
    try {
      // First commit changes
      const commitMessage = `[Rusty] ${proposal.description}`;
      const commitSha = await this.commitChanges(branch, changes, commitMessage);
      
      // Generate PR description
      const prBody = this.generatePRDescription(proposal, changes);
      
      // Create PR
      const pr = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: `[Rusty Ultimate] ${proposal.description}`,
        head: branch,
        base: 'main',
        body: prBody,
      });
      
      return {
        number: pr.data.number,
        url: pr.data.html_url,
        branch,
        commitSha,
        createdAt: new Date(pr.data.created_at),
      };
    } catch (error) {
      throw new Error(`PR creation failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Monitor CI/CD status for a pull request
   */
  async monitorCIStatus(pullNumber: number): Promise<CIStatus> {
    try {
      const pr = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: pullNumber,
      });
      
      const checks = await this.octokit.checks.listForRef({
        owner: this.owner,
        repo: this.repo,
        ref: pr.data.head.sha,
      });
      
      const statuses = await this.octokit.repos.listCommitStatusesForRef({
        owner: this.owner,
        repo: this.repo,
        ref: pr.data.head.sha,
      });
      
      // Determine overall status
      let overallStatus: 'pending' | 'passing' | 'failing' = 'pending';
      
      if (checks.data.total_count === 0 && statuses.data.length === 0) {
        overallStatus = 'pending';
      } else {
        const allChecks = [
          ...checks.data.check_runs.map(c => c.conclusion),
          ...statuses.data.map(s => s.state),
        ];
        
        if (allChecks.some(c => c === 'failure' || c === 'error')) {
          overallStatus = 'failing';
        } else if (allChecks.every(c => c === 'success')) {
          overallStatus = 'passing';
        }
      }
      
      return {
        status: overallStatus,
        checks: checks.data.check_runs.map(check => ({
          name: check.name,
          status: check.status,
          conclusion: check.conclusion,
          url: check.html_url,
        })),
        pullNumber,
      };
    } catch (error) {
      throw new Error(`CI status check failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Check for merge conflicts
   */
  async checkMergeConflicts(pullNumber: number): Promise<boolean> {
    try {
      const pr = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: pullNumber,
      });
      
      return pr.data.mergeable === false;
    } catch (error) {
      throw new Error(`Merge conflict check failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get merge conflict details
   */
  async getMergeConflictDetails(pullNumber: number): Promise<string[]> {
    try {
      const files = await this.octokit.pulls.listFiles({
        owner: this.owner,
        repo: this.repo,
        pull_number: pullNumber,
      });
      
      return files.data
        .filter(file => file.status === 'conflicted')
        .map(file => file.filename);
    } catch (error) {
      throw new Error(`Get conflict details failed: ${(error as Error).message}`);
    }
  }
  
  // Private helper methods
  
  private async getLatestCommitSha(branch: string): Promise<string> {
    const ref = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branch}`,
    });
    
    return ref.data.object.sha;
  }
  
  private generatePRDescription(
    proposal: Proposal,
    changes: FileChange[]
  ): string {
    let description = `## Rusty Ultimate - Automated Code Improvement\n\n`;
    
    description += `### Proposal Summary\n\n`;
    description += `${proposal.description}\n\n`;
    
    description += `### Risk Assessment\n\n`;
    description += `- **Risk Score:** ${proposal.riskScore}/100\n`;
    description += `- **Impact Level:** ${proposal.impactAnalysis.estimatedRisk}\n`;
    description += `- **Files Changed:** ${changes.length}\n\n`;
    
    if (proposal.analysis.issues.length > 0) {
      description += `### Issues Addressed\n\n`;
      proposal.analysis.issues.slice(0, 5).forEach((issue, i) => {
        description += `${i + 1}. **${issue.title}** (${issue.severity})\n`;
        description += `   - File: \`${issue.file}:${issue.line}\`\n`;
        description += `   - ${issue.description}\n\n`;
      });
    }
    
    description += `### Changed Files\n\n`;
    changes.forEach(change => {
      const icon = change.type === 'create' ? '✨' : change.type === 'delete' ? '🗑️' : '📝';
      description += `- ${icon} \`${change.file}\`\n`;
    });
    
    description += `\n---\n\n`;
    description += `*This PR was automatically generated by Rusty Ultimate meta-agent*\n`;
    description += `*Review carefully before merging*\n`;
    
    return description;
  }
}
```

---

**Continue to:** [Part 3 - MCP Framework & Implementation Roadmap](./rusty_ultimate_roadmap_part3.md)
