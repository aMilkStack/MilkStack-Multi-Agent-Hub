/**
 * AI Configuration
 *
 * Centralized configuration for AI models and safety settings.
 * This prevents hardcoded strings scattered across the codebase.
 */

import { HarmCategory, HarmBlockThreshold } from "@google/genai";

/**
 * Default model for all AI operations
 * Using Gemini 2.5 Pro for superior reasoning and quality
 */
export const DEFAULT_MODEL = 'gemini-2.5-pro' as const;

/**
 * Fallback model (currently same as default since we only use gemini-2.5-pro)
 * Kept for future flexibility if we need to add fallback logic
 */
export const FALLBACK_MODEL = 'gemini-2.5-pro' as const;

/**
 * Safety settings to disable Gemini's content filters.
 * Required because agents like "Adversarial Thinker" use security terminology
 * that triggers DANGEROUS_CONTENT blocks.
 *
 * These settings should be applied to all Gemini API calls.
 */
export const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
] as const;

/**
 * Rate limiting configuration for Gemini API
 */
export const RATE_LIMIT_CONFIG = {
    FREE_TIER: {
        ratePerSecond: 0.2,  // 12 RPM (0.2 calls/sec) - safe buffer for 15 RPM limit
        maxParallelism: 3,
    },
    PAID_TIER: {
        ratePerSecond: 2.0,  // 120 RPM (2.0 calls/sec) - safe buffer for 150 RPM limit
        maxParallelism: 10,
    },
} as const;

/**
 * Model identifiers used throughout the application
 */
export const MODELS = {
    PRO: DEFAULT_MODEL,
    FLASH: 'gemini-2.5-flash',
} as const;
