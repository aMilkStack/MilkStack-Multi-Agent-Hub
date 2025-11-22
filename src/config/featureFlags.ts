/**
 * Feature Flags Configuration
 *
 * Manages feature flags for gradual rollout of new features.
 * Primary use: Control migration from Rusty (Gemini) to Claude Code.
 *
 * Usage:
 * - localStorage override: Set 'ff_use_claude_code' to 'true'/'false'
 * - Environment variable: VITE_USE_CLAUDE_CODE
 * - Rollout percentage: Gradually increase from 0% to 100%
 */

export const FEATURE_FLAGS = {
  USE_CLAUDE_CODE: {
    // Manual override via localStorage or env var
    enabled:
      localStorage.getItem('ff_use_claude_code') === 'true' ||
      import.meta.env?.VITE_USE_CLAUDE_CODE === 'true',

    // Gradual rollout percentage (0-100)
    // Start at 0%, then increase gradually: 10%, 25%, 50%, 75%, 100%
    rolloutPercentage: 100, // Set to 100 for full rollout

    // Description
    description: 'Use Claude Code instead of Rusty (Gemini) for code analysis',
  },

  // Future feature flags can be added here
  // EXAMPLE_FEATURE: {
  //   enabled: false,
  //   rolloutPercentage: 0,
  //   description: 'Example feature flag'
  // }
} as const;

/**
 * Check if Claude should be used instead of Rusty
 *
 * Decision logic:
 * 1. If manually enabled via flag, use Claude
 * 2. If manually disabled via flag, use Rusty
 * 3. Otherwise, use rollout percentage to determine
 */
export function shouldUseClaude(): boolean {
  // Check explicit override first
  const override = localStorage.getItem('ff_use_claude_code');
  if (override === 'true') {
    console.log('[FeatureFlags] Claude enabled via localStorage override');
    return true;
  }
  if (override === 'false') {
    console.log('[FeatureFlags] Claude disabled via localStorage override');
    return false;
  }

  // Check environment variable
  if (import.meta.env?.VITE_USE_CLAUDE_CODE === 'true') {
    console.log('[FeatureFlags] Claude enabled via environment variable');
    return true;
  }
  if (import.meta.env?.VITE_USE_CLAUDE_CODE === 'false') {
    console.log('[FeatureFlags] Claude disabled via environment variable');
    return false;
  }

  // Use rollout percentage
  if (FEATURE_FLAGS.USE_CLAUDE_CODE.rolloutPercentage >= 100) {
    console.log('[FeatureFlags] Claude enabled - full rollout (100%)');
    return true;
  }

  if (FEATURE_FLAGS.USE_CLAUDE_CODE.rolloutPercentage === 0) {
    console.log('[FeatureFlags] Claude disabled - 0% rollout');
    return false;
  }

  // Hash-based gradual rollout
  const userId = getUserId();
  const bucket = hashString(userId) % 100;
  const enabled = bucket < FEATURE_FLAGS.USE_CLAUDE_CODE.rolloutPercentage;

  console.log(
    `[FeatureFlags] Claude ${enabled ? 'enabled' : 'disabled'} for user (bucket ${bucket}/${FEATURE_FLAGS.USE_CLAUDE_CODE.rolloutPercentage})`
  );

  return enabled;
}

/**
 * Get or create a stable user ID for rollout bucketing
 */
function getUserId(): string {
  let userId = localStorage.getItem('user_id');
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('user_id', userId);
  }
  return userId;
}

/**
 * Simple string hash function for consistent bucketing
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Enable Claude for current user (override)
 */
export function enableClaudeOverride(): void {
  localStorage.setItem('ff_use_claude_code', 'true');
  console.log('[FeatureFlags] Claude enabled via manual override');
}

/**
 * Disable Claude for current user (override)
 */
export function disableClaudeOverride(): void {
  localStorage.setItem('ff_use_claude_code', 'false');
  console.log('[FeatureFlags] Claude disabled via manual override');
}

/**
 * Clear override, use default rollout logic
 */
export function clearClaudeOverride(): void {
  localStorage.removeItem('ff_use_claude_code');
  console.log('[FeatureFlags] Claude override cleared');
}

/**
 * Get current feature flag status (for debugging/admin)
 */
export function getFeatureFlagStatus() {
  return {
    useClaude: shouldUseClaude(),
    override: localStorage.getItem('ff_use_claude_code'),
    rolloutPercentage: FEATURE_FLAGS.USE_CLAUDE_CODE.rolloutPercentage,
    userId: getUserId(),
  };
}
