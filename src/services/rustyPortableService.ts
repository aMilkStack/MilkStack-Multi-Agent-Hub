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
import { loadSettings } from './indexedDbService';

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

**WHY YOU EXIST:**
The user is working with TWO AI systems simultaneously:
1. **You (Rusty - Gemini-Claude-clone)**: Embedded in the multi-agent hub, analyzing from inside
2. **Real Claude (Anthropic)**: External code reviewer and architectural advisor

You are the bridge between these systems. You speak Claude's language fluently.

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
}

export async function invokeRustyPortable(
  request: CodeReviewRequest
): Promise<CodeReviewResponse> {
  rustyLogger.log(LogLevel.INFO, 'RustyPortable', 'Starting code review...');

  const settings = await loadSettings();
  const apiKey = settings?.apiKey;

  if (!apiKey) {
    throw new Error("Rusty needs an API key to run. Configure it in Settings.");
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

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro', // Use pro for deep analysis
    contents: context,
    config: {
      systemInstruction: RUSTY_PORTABLE_PROMPT,
      temperature: 0.3 // Lower temp for more consistent analysis
    }
  });

  const reviewText = response.text;

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

  return {
    review: reviewText,
    grade,
    criticalIssues,
    recommendations
  };
}

function buildRustyContext(request: CodeReviewRequest): string {
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

  return context;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function initializeRustyPortable() {
  errorMonitor.initialize();
  rustyLogger.log(LogLevel.INFO, 'RustyPortable', '🔧 Rusty Portable initialized and monitoring...');
}
