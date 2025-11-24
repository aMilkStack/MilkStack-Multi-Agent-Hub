import { describe, it, expect } from 'vitest';
import {
  normalizeToIdentifier,
  idToIdentifier,
  findAgentByIdentifier,
  isValidAgentIdentifier,
  getAgentIdentifierFormats,
  getIdentifierToIdMap,
  getOrchestratorAgentList,
  isSpecialIdentifier,
  SPECIAL_IDENTIFIERS,
} from './agentIdentifiers';

describe('agentIdentifiers', () => {
  describe('normalizeToIdentifier', () => {
    it('should convert display names to kebab-case', () => {
      expect(normalizeToIdentifier('Product Planner')).toBe('product-planner');
      expect(normalizeToIdentifier('System Architect')).toBe('system-architect');
      expect(normalizeToIdentifier('Debug Specialist')).toBe('debug-specialist');
    });

    it('should handle ampersands correctly', () => {
      expect(normalizeToIdentifier('UX & UI Specialist')).toBe('ux-ui-specialist');
      expect(normalizeToIdentifier('Code & Design Expert')).toBe('code-design-expert');
    });

    it('should handle multiple spaces', () => {
      expect(normalizeToIdentifier('Advanced  Coding   Specialist')).toBe(
        'advanced-coding-specialist'
      );
    });

    it('should remove special characters', () => {
      expect(normalizeToIdentifier('Expert (Senior)')).toBe('expert-senior');
      expect(normalizeToIdentifier('AI/ML Specialist')).toBe('aiml-specialist');
    });

    it('should be case insensitive', () => {
      expect(normalizeToIdentifier('PRODUCT PLANNER')).toBe('product-planner');
      expect(normalizeToIdentifier('Product PLANNER')).toBe('product-planner');
    });

    it('should collapse multiple hyphens', () => {
      expect(normalizeToIdentifier('Test - - Agent')).toBe('test-agent');
    });

    it('should trim leading/trailing hyphens', () => {
      expect(normalizeToIdentifier(' Product Planner ')).toBe('product-planner');
      expect(normalizeToIdentifier('-Agent-')).toBe('agent');
    });
  });

  describe('idToIdentifier', () => {
    it('should extract identifier from full ID', () => {
      expect(idToIdentifier('agent-product-planner-001')).toBe('product-planner');
      expect(idToIdentifier('agent-builder-001')).toBe('builder');
      expect(idToIdentifier('agent-debug-specialist-001')).toBe('debug-specialist');
    });

    it('should handle IDs without prefix', () => {
      expect(idToIdentifier('product-planner-001')).toBe('product-planner');
    });

    it('should handle IDs without suffix', () => {
      expect(idToIdentifier('agent-product-planner')).toBe('product-planner');
    });

    it('should handle simple identifiers unchanged', () => {
      expect(idToIdentifier('product-planner')).toBe('product-planner');
    });
  });

  describe('findAgentByIdentifier', () => {
    it('should find agent by full ID', () => {
      const agent = findAgentByIdentifier('agent-product-planner-001');
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('Product Planner');
    });

    it('should find agent by display name', () => {
      const agent = findAgentByIdentifier('Product Planner');
      expect(agent).not.toBeNull();
      expect(agent?.id).toBe('agent-product-planner-001');
    });

    it('should find agent by simple identifier', () => {
      const agent = findAgentByIdentifier('product-planner');
      expect(agent).not.toBeNull();
      expect(agent?.id).toBe('agent-product-planner-001');
    });

    it('should be case insensitive', () => {
      const agent1 = findAgentByIdentifier('PRODUCT PLANNER');
      const agent2 = findAgentByIdentifier('product planner');
      const agent3 = findAgentByIdentifier('Product Planner');

      expect(agent1).not.toBeNull();
      expect(agent2).not.toBeNull();
      expect(agent3).not.toBeNull();
      expect(agent1?.id).toBe(agent2?.id);
      expect(agent2?.id).toBe(agent3?.id);
    });

    it('should handle orchestrator', () => {
      const agent = findAgentByIdentifier('orchestrator');
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('Orchestrator');
    });

    it('should handle builder', () => {
      const agent = findAgentByIdentifier('builder');
      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('Builder');
    });

    it('should return null for invalid identifier', () => {
      expect(findAgentByIdentifier('non-existent-agent')).toBeNull();
      expect(findAgentByIdentifier('')).toBeNull();
    });

    it('should handle whitespace', () => {
      const agent = findAgentByIdentifier('  product-planner  ');
      expect(agent).not.toBeNull();
      expect(agent?.id).toBe('agent-product-planner-001');
    });
  });

  describe('isValidAgentIdentifier', () => {
    it('should return true for valid identifiers', () => {
      expect(isValidAgentIdentifier('product-planner')).toBe(true);
      expect(isValidAgentIdentifier('Product Planner')).toBe(true);
      expect(isValidAgentIdentifier('agent-product-planner-001')).toBe(true);
    });

    it('should return false for invalid identifiers', () => {
      expect(isValidAgentIdentifier('invalid-agent')).toBe(false);
      expect(isValidAgentIdentifier('')).toBe(false);
    });
  });

  describe('getAgentIdentifierFormats', () => {
    it('should return all formats for an agent', () => {
      const agent = findAgentByIdentifier('Product Planner');
      expect(agent).not.toBeNull();

      const formats = getAgentIdentifierFormats(agent!);

      expect(formats.fullId).toBe('agent-product-planner-001');
      expect(formats.simpleIdentifier).toBe('product-planner');
      expect(formats.displayName).toBe('Product Planner');
    });
  });

  describe('getIdentifierToIdMap', () => {
    it('should create a mapping of identifiers to IDs', () => {
      const map = getIdentifierToIdMap();

      expect(map['product-planner']).toBe('agent-product-planner-001');
      expect(map['builder']).toBe('agent-builder-001');
      expect(map['orchestrator']).toBe('agent-orchestrator-001');
    });

    it('should include all agents', () => {
      const map = getIdentifierToIdMap();
      const keys = Object.keys(map);

      // Should have entries for all agents (check for a reasonable number)
      expect(keys.length).toBeGreaterThan(5);
    });
  });

  describe('getOrchestratorAgentList', () => {
    it('should return list with all required fields', () => {
      const list = getOrchestratorAgentList();

      expect(list.length).toBeGreaterThan(0);

      const first = list[0];
      expect(first).toHaveProperty('identifier');
      expect(first).toHaveProperty('fullId');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('description');
    });

    it('should exclude specified IDs', () => {
      const list = getOrchestratorAgentList(['agent-orchestrator-001']);

      const hasOrchestrator = list.some((a) => a.fullId === 'agent-orchestrator-001');
      expect(hasOrchestrator).toBe(false);
    });

    it('should have consistent identifier/ID pairs', () => {
      const list = getOrchestratorAgentList();

      for (const item of list) {
        // Verify that the identifier can resolve back to the full ID
        const found = findAgentByIdentifier(item.identifier);
        expect(found?.id).toBe(item.fullId);
      }
    });
  });

  describe('isSpecialIdentifier', () => {
    it('should recognize WAIT_FOR_USER', () => {
      expect(isSpecialIdentifier('WAIT_FOR_USER')).toBe(true);
      expect(isSpecialIdentifier(SPECIAL_IDENTIFIERS.WAIT_FOR_USER)).toBe(true);
    });

    it('should recognize CONSENSUS_REACHED', () => {
      expect(isSpecialIdentifier('CONSENSUS_REACHED')).toBe(true);
      expect(isSpecialIdentifier(SPECIAL_IDENTIFIERS.CONSENSUS_REACHED)).toBe(true);
    });

    it('should return false for non-special identifiers', () => {
      expect(isSpecialIdentifier('product-planner')).toBe(false);
      expect(isSpecialIdentifier('builder')).toBe(false);
      expect(isSpecialIdentifier('')).toBe(false);
    });
  });
});
