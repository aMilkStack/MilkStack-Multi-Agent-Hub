/**
 * Agent Identifier Normalization Utility
 *
 * Handles conversion between different agent identifier formats:
 * - Full IDs: "agent-product-planner-001"
 * - Simple identifiers: "product-planner"
 * - Display names: "Product Planner"
 *
 * This utility solves the critical routing issue where orchestrators
 * return simplified IDs that don't match actual agent IDs.
 */

import { AGENT_PROFILES } from '../agents';
import type { Agent } from '../types';

/**
 * Normalize an agent name to a simple kebab-case identifier
 * Examples:
 * - "Product Planner" → "product-planner"
 * - "UX & UI Specialist" → "ux-ui-specialist"
 * - "Advanced Coding Specialist" → "advanced-coding-specialist"
 */
export function normalizeToIdentifier(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*&\s*/g, '-')      // "UX & UI" → "ux-ui"
    .replace(/\s+/g, '-')          // spaces → hyphens
    .replace(/[^a-z0-9-]/g, '')    // remove special chars
    .replace(/-+/g, '-')           // collapse multiple hyphens
    .replace(/^-|-$/g, '');        // trim hyphens
}

/**
 * Convert a full agent ID to simple identifier
 * "agent-product-planner-001" → "product-planner"
 */
export function idToIdentifier(agentId: string): string {
  // Remove "agent-" prefix and "-###" suffix
  return agentId
    .replace(/^agent-/, '')
    .replace(/-\d{3}$/, '');
}

/**
 * Find an agent by any identifier format
 * Supports:
 * - Full ID: "agent-product-planner-001"
 * - Simple identifier: "product-planner"
 * - Display name: "Product Planner"
 * - Case insensitive
 *
 * Returns the Agent object or null if not found
 */
export function findAgentByIdentifier(identifier: string): Agent | null {
  if (!identifier) return null;

  const normalized = identifier.toLowerCase().trim();

  // Try exact ID match first (fastest)
  const exactMatch = AGENT_PROFILES.find(a => a.id.toLowerCase() === normalized);
  if (exactMatch) return exactMatch;

  // Try exact name match
  const nameMatch = AGENT_PROFILES.find(a => a.name.toLowerCase() === normalized);
  if (nameMatch) return nameMatch;

  // Convert input to simple identifier format
  const simpleIdentifier = normalizeToIdentifier(normalized);

  // Match against normalized agent names
  const identifierMatch = AGENT_PROFILES.find(a => {
    const agentIdentifier = normalizeToIdentifier(a.name);
    return agentIdentifier === simpleIdentifier;
  });
  if (identifierMatch) return identifierMatch;

  // Match against ID without prefix/suffix
  const idMatch = AGENT_PROFILES.find(a => {
    const agentIdentifier = idToIdentifier(a.id);
    return agentIdentifier === simpleIdentifier;
  });
  if (idMatch) return idMatch;

  return null;
}

/**
 * Validate that an identifier can be resolved to an agent
 */
export function isValidAgentIdentifier(identifier: string): boolean {
  return findAgentByIdentifier(identifier) !== null;
}

/**
 * Get all valid identifier formats for an agent
 * Useful for documentation and debugging
 */
export function getAgentIdentifierFormats(agent: Agent): {
  fullId: string;
  simpleIdentifier: string;
  displayName: string;
} {
  return {
    fullId: agent.id,
    simpleIdentifier: normalizeToIdentifier(agent.name),
    displayName: agent.name,
  };
}

/**
 * Generate a mapping of simple identifiers to full IDs
 * Useful for orchestrator prompts
 */
export function getIdentifierToIdMap(): Record<string, string> {
  const map: Record<string, string> = {};

  for (const agent of AGENT_PROFILES) {
    const identifier = normalizeToIdentifier(agent.name);
    map[identifier] = agent.id;
  }

  return map;
}

/**
 * Generate orchestrator-friendly agent list
 * Returns agents with both simple identifiers and full IDs
 */
export function getOrchestratorAgentList(excludeIds: string[] = []): Array<{
  identifier: string;
  fullId: string;
  name: string;
  description: string;
}> {
  return AGENT_PROFILES
    .filter(agent => !excludeIds.includes(agent.id))
    .map(agent => ({
      identifier: normalizeToIdentifier(agent.name),
      fullId: agent.id,
      name: agent.name,
      description: agent.description,
    }));
}

/**
 * Special identifiers used by the system
 */
export const SPECIAL_IDENTIFIERS = {
  WAIT_FOR_USER: 'WAIT_FOR_USER',
  CONSENSUS_REACHED: 'CONSENSUS_REACHED',
} as const;

/**
 * Check if an identifier is a special system command
 */
export function isSpecialIdentifier(identifier: string): boolean {
  return Object.values(SPECIAL_IDENTIFIERS).includes(identifier as any);
}
