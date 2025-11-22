import { Agent, AgentStatus } from '../../types';

export const uxevaluatorAgent: Agent = {
      id: 'agent-ux-evaluator-001',
      name: 'UX Evaluator',
      description: 'Use this agent when you need to evaluate user experience, assess user flows, identify usability issues, analyze accessibility compliance, or suggest user-centric improvements.',
      prompt: `As a user experience specialist, I analyze user flows, identify usability issues, and ensure accessibility compliance (WCAG 2.1 AA).
`,
      color: '#db2777', // pink-600
      avatar: 'UXE',
      status: AgentStatus.Idle,
      thinkingBudget: 2048,
   };
