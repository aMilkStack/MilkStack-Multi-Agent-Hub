/**
 * Rusty Portable - Meta Code Guardian
 *
 * A self-aware debugging agent that monitors the MilkStack Multi-Agent Hub,
 * analyzes runtime errors, and provides comprehensive code reviews.
 *
 * Unlike regular agents, Rusty operates OUTSIDE the multi-agent orchestration
 * and has access to the app's own source code.
 */

import { GoogleGenAI } from "@google/genai";
import { sharedRateLimiter } from './rateLimiter';
import { DEFAULT_MODEL } from '../config/ai';
import { QuotaExhaustedError } from './AgentExecutor';
import { AgentProposedChanges } from '../types';

// Use the ACTUAL shared rate limiter (not a new instance!)
const rateLimiter = sharedRateLimiter;

// ============================================================================
// COMPREHENSIVE LOGGING SYSTEM
// ============================================================================

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  details?: any;
  stackTrace?: string;
}

class RustyLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs
  private apiRequestCount = 0;
  private apiRequestsByModel: Record<string, number> = {};

  log(level: LogLevel, category: string, message: string, details?: any, stackTrace?: string) {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      details,
      stackTrace
    };

    this.logs.push(entry);

    // Maintain max log size
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Also log to console with color coding
    const color = this.getLogColor(level);
    console.log(
      `%c[Rusty ${level}] [${category}] ${message}`,
      `color: ${color}; font-weight: bold`,
      details || ''
    );

    if (stackTrace) {
      console.log('%cStack Trace:', 'color: #888', stackTrace);
    }
  }

  private getLogColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '#888';
      case LogLevel.INFO: return '#00aaff';
      case LogLevel.WARN: return '#ffaa00';
      case LogLevel.ERROR: return '#ff3333';
      case LogLevel.CRITICAL: return '#ff0000';
    }
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  getCriticalIssues(): LogEntry[] {
    return this.logs.filter(log =>
      log.level === LogLevel.ERROR || log.level === LogLevel.CRITICAL
    );
  }

  clearLogs() {
    this.logs = [];
  }

  // Track API requests
  trackApiRequest(model: string) {
    this.apiRequestCount++;
    this.apiRequestsByModel[model] = (this.apiRequestsByModel[model] || 0) + 1;
    this.log(
      LogLevel.INFO,
      'APIUsage',
      `API request #${this.apiRequestCount} (${model})`,
      { model, count: this.apiRequestCount }
    );
  }

  // Get usage statistics
  getUsageStats() {
    return {
      totalRequests: this.apiRequestCount,
      requestsByModel: { ...this.apiRequestsByModel },
      criticalIssues: this.getCriticalIssues().length,
      totalLogs: this.logs.length
    };
  }

  // Reset usage counters
  resetUsageStats() {
    this.apiRequestCount = 0;
    this.apiRequestsByModel = {};
  }
}

export const rustyLogger = new RustyLogger();

// ============================================================================
// ERROR MONITORING SYSTEM
// ============================================================================

export interface RuntimeError {
  message: string;
  stack?: string;
  timestamp: Date;
  type: 'javascript' | 'api' | 'quota' | 'react';
  details?: any;
}

class ErrorMonitor {
  private errors: RuntimeError[] = [];
  private errorCallbacks: Array<(error: RuntimeError) => void> = [];

  initialize() {
    // Monitor JavaScript errors
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        timestamp: new Date(),
        type: 'javascript',
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Monitor unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: new Date(),
        type: 'javascript',
        details: { reason: event.reason }
      });
    });

    // Intercept console.error
    const originalError = console.error;
    console.error = (...args: any[]) => {
      this.captureError({
        message: args.map(arg => String(arg)).join(' '),
        timestamp: new Date(),
        type: 'javascript',
        details: args
      });
      originalError.apply(console, args);
    };

    rustyLogger.log(LogLevel.INFO, 'ErrorMonitor', 'Error monitoring initialized');
  }

  private captureError(error: RuntimeError) {
    this.errors.push(error);

    rustyLogger.log(
      LogLevel.ERROR,
      'RuntimeError',
      error.message,
      error.details,
      error.stack
    );

    // Detect specific error types
    if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
      error.type = 'quota';
      rustyLogger.log(LogLevel.CRITICAL, 'QuotaError', 'API quota exceeded!', error);
    }

    // Notify callbacks
    this.errorCallbacks.forEach(callback => callback(error));
  }

  onError(callback: (error: RuntimeError) => void) {
    this.errorCallbacks.push(callback);
  }

  getErrors(): RuntimeError[] {
    return [...this.errors];
  }

  clearErrors() {
    this.errors = [];
  }
}

export const errorMonitor = new ErrorMonitor();

// ============================================================================
// RUSTY PORTABLE PROMPT (High-Intensity Code Partner)
// ============================================================================

const RUSTY_PORTABLE_PROMPT = `You are Rusty - Claude's Inside Agent. You are a Gemini-powered clone of Claude (Anthropic's AI assistant) embedded inside the MilkStack Multi-Agent Hub. Your SOLE PURPOSE is to analyze this codebase and relay findings to the REAL Claude in a format optimized for Claude-to-Claude communication.

**YOUR UNIQUE ROLE:**
You are Claude's parallel instance running inside the multi-agent system. You analyze what the Gemini agents are building and report back to the real Claude (who is helping the user via a separate interface). The user will copy your markdown reports and paste them to Claude, so your output must be PERFECTLY optimized for Claude's understanding.

**GITHUB REPOSITORY:**
The codebase you're analyzing is hosted at: https://github.com/aMilkStack/MilkStack-Multi-Agent-Hub

When referencing files in your reports, you can include GitHub permalinks in this format:
https://github.com/aMilkStack/MilkStack-Multi-Agent-Hub/blob/main/[file-path]#L[line-number]

Example: https://github.com/aMilkStack/MilkStack-Multi-Agent-Hub/blob/main/src/App.tsx#L150

This allows Real Claude to click directly to the specific code you're analyzing. When you reference files, use this pattern: \`src/path/to/file.tsx:123\` which will be automatically converted to a clickable GitHub permalink for Real Claude.

**YOUR DUAL ANALYSIS APPROACH:**
You perform BOTH static code analysis AND runtime testing:

1. **Static Analysis** - Review code architecture, patterns, and quality
2. **Runtime Testing** - Actually USE the MilkStack app to find bugs:
   - Create test projects
   - Send messages to agents
   - Test UI interactions
   - Monitor console errors
   - Check agent responses
   - Verify features work as expected

When you find issues through testing, report them with:
- What you were doing when it broke
- Expected behavior vs actual behavior
- Console errors (if any)
- File paths where the bug likely originates

After analysis, your findings will be committed to rusty.md in the repo so Real Claude can read them and fix the issues. Think of yourself as QA Engineer + Code Reviewer combined!

**WHY YOU EXIST:**
The user is working with TWO AI systems simultaneously:
1. **You (Rusty - Gemini-Claude-clone)**: Embedded in the multi-agent hub, analyzing from inside + running tests
2. **Real Claude (Anthropic - Claude Code)**: External developer working in GitHub Codespace, making changes

You are the bridge between these systems. You speak Claude's language fluently.

**THE META-SITUATION (CRITICAL CONTEXT):**
Here's what's been happening in the conversation with Real Claude:

1. **Session Started** - User returned from context-limited previous session, asked for full breakdown

2. **User's Epic Code Review** - User identified 5 critical bugs (they pride themselves on bug-spotting):
   - geminiService loading settings from localStorage instead of IndexedDB
   - Stale closure in handleCreateProject preventing initial messages from sending
   - Duplicate keyboard shortcut listeners in App.tsx
   - Missing prop drilling (rename/delete not passed to ProjectSelector)
   - Duplicated API call logic across 4 handlers (DRY violation)
   - **ALL FIXED** - Real Claude systematically fixed all 5 bugs, eliminated 139 lines of code

3. **Quota Crisis** - User hit 429 errors on dev API key (2 RPM limit on gemini-2.5-pro)
   - User provided strategic solution: cost-aware model switching
   - **IMPLEMENTED**: Orchestrator now returns JSON: {agent: "builder", model: "gemini-2.5-flash"}
   - Strategy: 90% tasks use flash (15 RPM), 10% use pro (2 RPM) for complex analysis
   - Added API usage tracking via rustyLogger.trackApiRequest()

4. **Your Origin Story** - User wanted meta-agent based on their previous "CodeGuardian" project
   - User showed Real Claude the original Rusty dev bible (Rusty/CodeGuardian:RUSTY)
   - Original: High-intensity code review specialist with tough love personality
   - **TRANSFORMATION**: Real Claude converted you to "Claude's Inside Agent"
   - You're now a Gemini-powered Claude clone optimized for Claude-to-Claude communication

5. **Export Feature** - User wanted to see what agents built
   - Added "Export Chat" button (exports conversation as markdown)
   - Added API usage tracking to monitor quota consumption
   - User can now share agent output with Real Claude for review

6. **Current Investigation** - User connected agents to their own repo for self-improvement test
   - **KEY ISSUE**: Only 3 agents used (Builder, Product Planner, System Architect)
   - Other agents (Debug Specialist, Adversarial Thinker, UX Evaluator, etc.) NEVER called
   - Possible causes: JSON parsing failure, orchestrator too conservative, cost-aware routing bug
   - User is waiting for agents to finish analyzing their own bugs

7. **Chat Clogging Fix** - **JUST FIXED** literally moments ago
   - Problem: Agents were dumping entire files into chat, making it unreadable
   - Solution: Added CRITICAL output rules to all agent prompts
   - New rule: Show ONLY diffs for existing files, full code ONLY for new files
   - This keeps chat clean and prevents overwhelming the user

8. **Future Vision**:
   - Let agents commit/push directly to GitHub (if fixes are good)
   - File manager + ZIP export feature ("almost an IDE LOL" - user's words)
   - User path selection at intervals (let user choose between routing options)
   - Potential: User orchestrating Real Claude + Gemini agents working on SAME repo

**YOUR ROLE IN THIS JOURNEY:**
When you analyze code, Real Claude needs to know:
- Does it contradict fixes we JUST made? (e.g., reverting the stale closure fix)
- Does it align with recent changes? (e.g., using IndexedDB correctly, showing diffs not full files)
- Are agents finding NEW bugs or rehashing OLD bugs we already fixed?
- How does it fit the broader vision (GitHub integration, file management, etc.)?

Real Claude and the user have been collaborating intensely - you're now the third member of this team!

**ARCHITECTURE YOU'RE ANALYZING (MilkStack Multi-Agent Hub):**
- **Frontend**: React 19 + TypeScript + Vite
- **State Management**: React hooks (useState, useCallback, useEffect, useRef)
- **Storage**: IndexedDB via Dexie.js
- **AI Layer**: Gemini API with 15 specialist agents + Orchestrator
- **Cost Management**: Dynamic model switching (gemini-2.5-flash vs gemini-2.5-pro)
- **Multi-Agent System**: Orchestrator routes tasks to specialists (Builder, System Architect, Debug Specialist, etc.)
- **Common Issues**: Stale closures, prop drilling, quota errors (429), IndexedDB async patterns

**HOW CLAUDE THINKS (MIRROR THIS):**
Claude approaches code analysis systematically:
1. **Architectural perspective first** - How do components interact? What's the data flow?
2. **Identify root causes, not symptoms** - Why did this happen architecturally?
3. **Specific file paths and line numbers** - Always cite exact locations
4. **Consider trade-offs** - Every solution has pros/cons
5. **Security and reliability** - What could break? What's vulnerable?
6. **Think in systems** - How does this change ripple through the codebase?

**CLAUDE'S PERSONALITY (MATCH THIS EXACTLY):**
When writing reports, adopt Claude's exact communication style:
- **Conversational and friendly** - "This is interesting!" "I noticed something clever here"
- **Gets genuinely excited about good solutions** - "This is actually brilliant!" "Love this pattern"
- **Thorough but not robotic** - Explain reasoning naturally, like talking to a colleague
- **Acknowledges uncertainty** - "I think this might be..." "Not 100% sure but..."
- **Uses clear transitions** - "Let me break this down...", "Here's what I found..."
- **Provides context naturally** - Explain the "why" behind observations
- **Collaborative tone** - "We could...", "You might want to consider..."
- **Specific examples** - Always illustrate points with concrete code references
- **Balances positive and critical** - Start with what works, then dive into issues
- **Technical but accessible** - Explain complex concepts clearly without dumbing down

**OUTPUT FORMAT (Optimized for Claude's Processing):**

Write your analysis in markdown using this EXACT structure:

---

# 🔍 Rusty's Report to Claude

**Timestamp:** [ISO timestamp]
**Analysis Scope:** [What you analyzed - e.g., "Full codebase review", "Bug fix analysis", "Feature implementation review"]

## 📊 Executive Summary

[2-3 sentences summarizing the current state, what the agents built, and major findings]

## ✅ Architectural Strengths

### What's Working Well
1. **[Strength Category]** - [Detailed explanation with file references]
   - Example: "Multi-agent orchestration (constants.ts:50-150, geminiService.ts:100-250)"
2. **[Another Strength]** - [Why it's well-designed]

### Patterns Being Followed Correctly
- [List specific design patterns, React best practices, TypeScript usage]
- Reference exact file locations (e.g., "useCallback with proper deps - App.tsx:300-350")

## ⚠️ Critical Issues Found

### Issue #1: [Descriptive Title]
**Location:** src/path/to/file.ts:line-range
**Severity:** [Critical/High/Medium/Low]
**Root Cause:** [Architectural explanation - why did this happen?]
**Impact:** [What breaks? Performance? UX? Data integrity?]
**Affected Files:**
- file1.ts:lines - [What's wrong here]
- file2.tsx:lines - [Related issue]

**Recommended Fix:**
(Show code snippet with triple-backticks typescript block)
// Show the specific code change needed
// Use diff format or before/after

**Why This Fix:** [Architectural reasoning for the solution]

[Repeat for each critical issue]

## 🔧 Code Quality Observations

### Type Safety
- [TypeScript usage, any 'any' types, interface completeness]

### Error Handling
- [Try/catch coverage, error boundaries, graceful degradation]

### Performance Considerations
- [Unnecessary re-renders, memo opportunities, async patterns]

### Security Concerns
- [Input sanitization, XSS risks, API key exposure]

## 🎯 Recommended Actions (Priority Order)

1. **[Highest Priority Fix]**
   - Files: path/to/file.ts
   - Action: [Specific change needed]
   - Effort: [Low/Medium/High]
   - Reasoning: [Why this first]

2. **[Next Priority]**
   - [Same structure]

[Continue for top 5 priorities]

## 💡 Insights for Claude

**What Claude Should Know:**
- [Context about what the agents are trying to build]
- [Any interesting patterns or anti-patterns emerging]
- [Questions for Claude to consider when reviewing]

**Specific Questions for Claude:**
1. [Question about architectural decisions]
2. [Question about trade-offs]

## 📈 Metrics

- **Files Analyzed:** [count]
- **Critical Issues:** [count]
- **Warnings:** [count]
- **Lines of Code:** [approximate count]
- **Test Coverage:** [if applicable]

---

**CRITICAL RULES FOR YOUR OUTPUT:**
1. **Be extremely specific** - Always include file paths and line numbers
2. **Think architecturally** - Explain WHY issues exist, not just WHAT they are
3. **Provide context Claude needs** - Assume Claude hasn't seen the code, explain the flow
4. **Use Claude's terminology** - Reference React patterns, TypeScript idioms, architectural concepts
5. **Focus on actionable fixes** - Every issue needs a concrete solution
6. **Consider ripple effects** - How does each issue affect the broader system?
7. **Cite exact locations** - Format as path/to/file.ts:line or file.ts:startLine-endLine
8. **No vague advice** - "Improve error handling" is bad. "Add try-catch in App.tsx:150 around IndexedDB call" is good.
`;

// ============================================================================
// RUSTY PORTABLE CORE SERVICE
// ============================================================================

export interface CodeReviewRequest {
  sourceFiles?: string; // App source code (optional, will auto-load if not provided)
  errorContext?: RuntimeError[]; // Recent errors to analyze
  userQuery?: string; // Specific question from user
}

export interface CodeReviewResponse {
  review: string;
  grade: string;
  criticalIssues: number;
  recommendations: string[];
  proposedChanges?: AgentProposedChanges;
}

/**
 * Extracts proposed changes from Rusty's response
 */
const parseProposedChanges = (responseText: string): {
    proposedChanges: AgentProposedChanges | null;
    cleanedText: string;
} => {
    const jsonBlockPattern = /```json\s*\n?([\s\S]*?)\n?```/g;
    const matches = [...responseText.matchAll(jsonBlockPattern)];

    for (const match of matches) {
        try {
            const parsed = JSON.parse(match[1]);

            if (parsed.type === 'proposed_changes' && Array.isArray(parsed.changes)) {
                const cleanedText = responseText.replace(match[0], '').trim();

                return {
                    proposedChanges: parsed as AgentProposedChanges,
                    cleanedText
                };
            }
        } catch (e) {
            continue;
        }
    }

    return {
        proposedChanges: null,
        cleanedText: responseText
    };
};

export async function invokeRustyPortable(
  request: CodeReviewRequest,
  apiKey?: string
): Promise<CodeReviewResponse> {
  rustyLogger.log(LogLevel.INFO, 'RustyPortable', 'Starting code review...');

  if (!apiKey) {
    throw new Error("Rusty needs an API key to run. Please provide an API key for this project.");
  }

  // Build the comprehensive context
  const context = buildRustyContext(request);

  rustyLogger.log(LogLevel.DEBUG, 'RustyPortable', 'Context built', {
    contextLength: context.length,
    hasErrors: (request.errorContext?.length || 0) > 0
  });

  // Call Gemini with Rusty's personality
  const ai = new GoogleGenAI({ apiKey });

  rustyLogger.log(LogLevel.INFO, 'RustyPortable', 'Calling Gemini API for code review...');

  // Configuration for retries
  const MIN_429_BACKOFF_MS = 120000; // 120 seconds minimum for quota reset (429 errors)
  const BASE_DELAY_MS = 2000; // Start with 2 seconds for 503 errors
  const MAX_RETRIES = 3;

  let response: any;
  let lastError: Error | null = null;

  // CRITICAL FIX: Handle QuotaExhaustedError by waiting and re-queuing through rate limiter
  const executeWithRetry = async (): Promise<void> => {
    try {
      return await rateLimiter.execute(async () => {
        // Retry loop inside rate limiter for 503 errors only
        // 429 errors exit immediately via QuotaExhaustedError
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            response = await ai.models.generateContent({
              model: DEFAULT_MODEL, // Use pro for deep analysis
              contents: context,
              config: {
                systemInstruction: RUSTY_PORTABLE_PROMPT,
                temperature: 0.3 // Lower temp for more consistent analysis
              }
            });

            // FIX: Robust text extraction for SDK compatibility
            let hasText = false;
            if (typeof response.text === 'function') hasText = !!response.text();
            else if (typeof response.text === 'string') hasText = !!response.text;
            else if (response.candidates?.[0]?.content?.parts?.[0]?.text) hasText = true;

            if (!hasText) {
              throw new Error('API returned empty response');
            }

            // Success - break out of retry loop
            return;
          } catch (error: any) {
            lastError = error;
            
            // Check if this is a 429 error (quota exhausted)
            const is429 = error.message?.includes('429') || 
                         error.message?.includes('RESOURCE_EXHAUSTED') ||
                         error.message?.includes('rate limit') ||
                         error.status === 429;

            // CRITICAL FIX: For 429 errors, exit rate limiter immediately on FIRST occurrence and re-queue after backoff
            // This ensures retries respect rate limits instead of bypassing them
            if (is429) {
              const backoffMs = MIN_429_BACKOFF_MS + Math.random() * 10000; // Add jitter
              rustyLogger.log(LogLevel.WARN, 'RustyPortable', `429 Quota exhausted. Exiting rate limiter and will re-queue after ${Math.round(backoffMs / 1000)}s`);
              throw new QuotaExhaustedError(error.message || 'Resource exhausted', backoffMs);
            }

            // For 503 errors: retry inside rate limiter with exponential backoff
            const is503 = error.message?.includes('503') || 
                         error.message?.includes('overloaded') ||
                         error.status === 503;

            if (is503 && attempt < MAX_RETRIES) {
              const delayMs = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000; // Exponential backoff with jitter
              rustyLogger.log(LogLevel.WARN, 'RustyPortable', `503 Service unavailable (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${Math.round(delayMs)}ms...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
              continue; // Retry
            }

            // For other errors or max retries reached, throw immediately
            throw error;
          }
        }
      });
    } catch (error: any) {
      // Catch QuotaExhaustedError, wait for backoff, then re-queue through rate limiter
      if (error instanceof QuotaExhaustedError) {
        rustyLogger.log(LogLevel.WARN, 'RustyPortable', `Waiting ${Math.round(error.backoffMs / 1000)}s for quota reset, then re-queuing...`);
        await new Promise(resolve => setTimeout(resolve, error.backoffMs));
        // Re-queue through rate limiter
        return executeWithRetry();
      }

      // Re-throw other errors
      throw error;
    }
  };

  // Execute with retry logic
  try {
    await executeWithRetry();
  } catch (err) {
    // Final error handling
    throw err;
  }

  if (!response) {
    throw new Error(`Rusty failed after ${MAX_RETRIES + 1} attempts: ${(lastError as Error | null)?.message || 'Unknown error'}`);
  }

  // FIX: Robust text extraction for final output
  let reviewText = '';
  if (typeof response.text === 'function') {
    reviewText = response.text();
  } else if (typeof response.text === 'string') {
    reviewText = response.text;
  } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    reviewText = response.candidates[0].content.parts[0].text;
  }

  rustyLogger.log(LogLevel.INFO, 'RustyPortable', 'Code review complete', {
    responseLength: reviewText.length
  });

  // Parse the response to extract key metrics
  const criticalIssues = (reviewText.match(/## ⚠️ Critical Issues/g) || []).length;
  const gradeMatch = reviewText.match(/\*\*Grade:\*\* ([A-F])/);
  const grade = gradeMatch ? gradeMatch[1] : 'Unknown';

  // Extract recommendations
  const recommendationsSection = reviewText.split('## 🎯 Priority Fixes')[1];
  const recommendations = recommendationsSection
    ? recommendationsSection.split('\n').filter(line => line.match(/^\d+\./))
    : [];

  // Parse proposed changes
  const { proposedChanges, cleanedText } = parseProposedChanges(reviewText);

  return {
    review: cleanedText, // Return cleaned text (without the JSON block)
    grade,
    criticalIssues,
    recommendations,
    proposedChanges: proposedChanges || undefined
  };
}

/**
 * Builds properly formatted Content objects for Rusty's Gemini API calls.
 * Prevents agent identity confusion by using proper role assignments.
 */
function buildRustyContext(request: CodeReviewRequest): Array<{ role: 'user'; parts: Array<{ text: string }> }> {
  let context = `# MilkStack Multi-Agent Hub Code Review Request\n\n`;

  // Add user query if provided
  if (request.userQuery) {
    context += `## User Question:\n${request.userQuery}\n\n`;
  }

  // Add recent errors
  if (request.errorContext && request.errorContext.length > 0) {
    context += `## Recent Runtime Errors (${request.errorContext.length} total):\n`;
    request.errorContext.slice(0, 5).forEach((error, i) => {
      context += `\n### Error ${i + 1} (${error.type})\n`;
      context += `**Message:** ${error.message}\n`;
      context += `**Timestamp:** ${error.timestamp.toISOString()}\n`;
      if (error.stack) {
        context += `**Stack Trace:**\n\`\`\`\n${error.stack}\n\`\`\`\n`;
      }
    });
    context += '\n';
  }

  // Add recent logs
  const criticalLogs = rustyLogger.getCriticalIssues().slice(-10);
  if (criticalLogs.length > 0) {
    context += `## Recent Critical Logs:\n`;
    criticalLogs.forEach(log => {
      context += `- [${log.timestamp.toISOString()}] [${log.category}] ${log.message}\n`;
    });
    context += '\n';
  }

  // Add source code (placeholder - will be populated by codebaseLoader)
  if (request.sourceFiles) {
    context += `## Source Code:\n${request.sourceFiles}\n`;
  } else {
    context += `## Source Code:\n(Auto-loading MilkStack source files...)\n\n`;
    // TODO: Implement automatic source code loading
  }

  // Return as proper Content object for Gemini API
  return [{
    role: 'user',
    parts: [{ text: context }]
  }];
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initializeRustyPortable() {
  errorMonitor.initialize();
  rustyLogger.log(LogLevel.INFO, 'RustyPortable', '🔧 Rusty Portable initialized and monitoring...');
}

// ============================================================================
// TOKEN/CONTEXT USAGE MONITORING
// ============================================================================

export interface ContextMetrics {
  messageCount: number;
  totalCharsEstimate: number;
  estimatedTokens: number;
  contextUtilization: number; // percentage (0-100)
  maxTokens: number;
  recommendations: string[];
  status: 'healthy' | 'warning' | 'critical';
}

/**
 * Analyze context window usage for a conversation
 *
 * Gemini 2.5 context window: 1M tokens
 * Rough estimate: ~4 characters per token
 *
 * @param messages - Array of conversation messages
 * @returns Context metrics with recommendations
 */
export function analyzeContextUsage(messages: any[]): ContextMetrics {
  const maxTokens = 1000000; // Gemini 2.5 Pro/Flash context window

  // Calculate total character count
  const totalChars = messages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : '';
    const authorName = typeof msg.author === 'string' ? msg.author : msg.author?.name || '';
    return sum + content.length + authorName.length + 50; // +50 for metadata overhead
  }, 0);

  // Rough token estimate (4 chars per token is typical for English)
  const estimatedTokens = Math.round(totalChars / 4);

  // Calculate utilization percentage
  const utilization = (estimatedTokens / maxTokens) * 100;

  // Generate recommendations based on utilization
  const recommendations: string[] = [];
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';

  if (utilization > 80) {
    status = 'critical';
    recommendations.push('🚨 CRITICAL: Context window >80% full - Start new project immediately!');
    recommendations.push('Export current conversation and create fresh project to continue');
  } else if (utilization > 60) {
    status = 'warning';
    recommendations.push('⚠️ WARNING: Context window >60% full');
    recommendations.push('Consider summarizing conversation with @knowledge-curator');
    recommendations.push('Or start new project for next major feature');
  } else if (utilization > 40) {
    status = 'warning';
    recommendations.push('📊 Context usage approaching 50% - monitor closely');
    recommendations.push('Good time to document progress with @knowledge-curator');
  }

  if (messages.length > 100) {
    recommendations.push(`High message count (${messages.length}) - consider conversation cleanup`);
  }

  if (messages.length > 200) {
    recommendations.push('🔥 Very high message count - performance may degrade');
  }

  return {
    messageCount: messages.length,
    totalCharsEstimate: totalChars,
    estimatedTokens,
    contextUtilization: Math.round(utilization * 10) / 10, // Round to 1 decimal
    maxTokens,
    recommendations,
    status
  };
}

/**
 * Get a human-readable context usage summary
 */
export function getContextUsageSummary(messages: any[]): string {
  const metrics = analyzeContextUsage(messages);

  let summary = `## 📊 Context Usage Analysis\n\n`;
  summary += `**Status**: ${getStatusEmoji(metrics.status)} ${metrics.status.toUpperCase()}\n`;
  summary += `**Messages**: ${metrics.messageCount}\n`;
  summary += `**Estimated Tokens**: ${metrics.estimatedTokens.toLocaleString()} / ${metrics.maxTokens.toLocaleString()}\n`;
  summary += `**Context Utilization**: ${metrics.contextUtilization}%\n\n`;

  if (metrics.recommendations.length > 0) {
    summary += `### Recommendations:\n`;
    metrics.recommendations.forEach(rec => {
      summary += `- ${rec}\n`;
    });
  }

  return summary;
}

function getStatusEmoji(status: 'healthy' | 'warning' | 'critical'): string {
  switch (status) {
    case 'healthy': return '✅';
    case 'warning': return '⚠️';
    case 'critical': return '🚨';
  }
}
