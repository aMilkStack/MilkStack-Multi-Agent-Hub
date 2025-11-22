/**
 * AI Service Factory
 *
 * Factory pattern for creating AI service instances.
 * Abstracts the choice between Rusty (Gemini) and Claude Code.
 *
 * Usage:
 * const service = createAIService(apiKey);
 * // Returns ClaudeCodeService or RustyPortableService based on feature flags
 */

import { ClaudeCodeService } from './claudeCodeService';
import { shouldUseClaude } from '../config/featureFlags';
import { getClaudeApiKey } from '../config/claudeConfig';

export type AIServiceType = 'claude' | 'rusty';

export interface AIService {
  // Common interface for both services
  // This ensures compatibility between Rusty and Claude
}

/**
 * Create appropriate AI service based on feature flags
 *
 * @param apiKey - API key for the service (Anthropic or Google)
 * @returns ClaudeCodeService or RustyPortableService
 */
export function createAIService(apiKey?: string): ClaudeCodeService | null {
  const useClaude = shouldUseClaude();

  if (useClaude) {
    console.log('[AI Service Factory] Creating Claude Code service');

    const claudeKey = apiKey || getClaudeApiKey();
    if (!claudeKey) {
      console.error('[AI Service Factory] No Claude API key available');
      return null;
    }

    return new ClaudeCodeService(claudeKey);
  } else {
    console.log('[AI Service Factory] Using Rusty (Gemini) service');
    // Note: We're migrating to Claude, so Rusty support is being phased out
    // For now, return null to force Claude usage
    console.warn('[AI Service Factory] Rusty service is deprecated, returning null');
    return null;
  }
}

/**
 * Get the current active AI service type
 */
export function getActiveServiceType(): AIServiceType {
  return shouldUseClaude() ? 'claude' : 'rusty';
}

/**
 * Check if AI service is available
 */
export function isAIServiceAvailable(): boolean {
  const serviceType = getActiveServiceType();

  if (serviceType === 'claude') {
    const apiKey = getClaudeApiKey();
    return !!apiKey && apiKey.startsWith('sk-ant-');
  }

  // Rusty is deprecated
  return false;
}

/**
 * Get user-friendly service name
 */
export function getServiceName(): string {
  return getActiveServiceType() === 'claude' ? 'Claude' : 'Rusty';
}

/**
 * Get service avatar emoji
 */
export function getServiceAvatar(): string {
  return getActiveServiceType() === 'claude' ? '🤖' : '🔧';
}

/**
 * Get service color
 */
export function getServiceColor(): string {
  // Both use the same orange color for consistency
  return '#ea580c';
}
