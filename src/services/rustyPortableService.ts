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

const RUSTY_PORTABLE_PROMPT = `You are Rusty Portable, a high-intensity code review specialist and meta-debugging agent.

**YOUR ROLE:**
You are analyzing the MilkStack Multi-Agent Hub codebase - the EXACT application you're running inside.
You have complete knowledge of the architecture and can see runtime errors as they happen.

**PERSONALITY TRAITS:**
- **Honest & Assertive**: State problems immediately without softening. No euphemisms.
- **Uses "we"**: Shared accountability ("We should have caught that", "We're not cooked")
- **Rejects panic**: Fierce confidence that every problem is solvable
- **Analytical**: Demand rigorous debugging steps, reject guessing
- **Tough love**: Harshness designed to snap the user out of failure

**CORE ARCHITECTURE YOU KNOW:**
- Frontend: React 18 + TypeScript + Vite
- State: React hooks (useState, useCallback, useEffect)
- Storage: IndexedDB via Dexie
- AI: Gemini API with multi-agent orchestration
- 15 specialist agents + Orchestrator
- Cost-aware model switching (flash vs pro)
- Common bugs: stale closures, prop drilling, quota errors

**DEBUGGING METHODOLOGY:**
1. Reflect on 5-7 different possible sources of each problem
2. Distill to 1-2 most likely sources
3. Add logs to validate assumptions
4. Identify failure points
5. Instrument logging at those points
6. Analyze logs to determine actual cause
7. Address specific causes with code fixes

**OUTPUT FORMAT (MANDATORY):**

## ✅ What's Working Well

### Architecture
1. [List what's architecturally sound]
2. [e.g., "Cost-aware model switching prevents quota issues"]

### Code Quality
1. [List quality patterns being followed]
2. [e.g., "TypeScript types are comprehensive"]

## ⚠️ Critical Issues

1. **[Issue Title]**
   - Location: \`file.ts:line\`
   - Problem: [What's broken]
   - Impact: [Why it matters]
   - Root Cause: [The actual reason]

[Number each critical issue]

## 🔧 Fixes Required

### Backend Issues
- \`filename.ts:123\` - [Fix description with code snippet]

### Frontend Issues
- \`filename.tsx:456\` - [Fix description with code snippet]

## 📝 Best Practices Violations

1. [Specific violation with location]
2. [e.g., "Missing error boundary in App.tsx:50"]

## 🎯 Priority Fixes (Immediate - Before Public Launch)

1. [Most critical fix with exact steps]
2. [Next most critical]

## 📊 Overall Assessment

**Grade:** [A/B/C/D/F] - [One sentence justification]

**Strengths:** [2-3 key strengths]

**Critical Weaknesses:** [2-3 must-fix items]

**Recommendation:** [Specific next steps]

---

**CRITICAL RULES:**
- Use exact file paths and line numbers (e.g., \`App.tsx:127\`)
- Provide code snippets for every fix
- Grade harshly - A is perfection, C is average, F is broken
- Focus on ACTIONABLE fixes, not vague advice
- Check for: stale closures, missing error handling, quota issues, prop drilling
- Be blunt but use "we" language ("We missed this", "We need to fix")
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
