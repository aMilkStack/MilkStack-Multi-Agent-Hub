import { describe, it, expect } from 'vitest';
import { TaskParser } from './taskParser';

describe('TaskParser', () => {
  describe('extractTaskMap', () => {
    it('should extract valid task map from markdown', () => {
      const messageContent = `
Here is the task map:

\`\`\`json_task_map
{
  "title": "Test Project",
  "description": "A test project",
  "tasks": [
    {
      "id": "task-1",
      "objective": "Complete the task",
      "dependencies": [],
      "stages": [
        {
          "stageName": "IMPLEMENTATION",
          "objective": "Implement the feature",
          "agents": [
            {
              "agent": "Product Planner",
              "model": "gemini-2.5-pro"
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`

Let's proceed with this plan.
      `;

      const result = TaskParser.extractTaskMap(messageContent);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Test Project');
      expect(result?.description).toBe('A test project');
      expect(result?.tasks).toHaveLength(1);
      expect(result?.tasks[0].id).toBe('task-1');
    });

    it('should return null when no task map is found', () => {
      const messageContent = 'This is a message without a task map';
      const result = TaskParser.extractTaskMap(messageContent);
      expect(result).toBeNull();
    });

    it('should throw error for invalid JSON', () => {
      const messageContent = `
\`\`\`json_task_map
{ invalid json }
\`\`\`
      `;

      expect(() => TaskParser.extractTaskMap(messageContent)).toThrow(
        /Task map JSON parse error/
      );
    });

    it('should throw validation error when description is missing', () => {
      const messageContent = `
\`\`\`json_task_map
{
  "title": "Test Project",
  "tasks": [
    {
      "id": "task-1",
      "objective": "Complete the task",
      "dependencies": [],
      "stages": [
        {
          "stageName": "IMPLEMENTATION",
          "objective": "Implement the feature",
          "agents": [
            {
              "agent": "Product Planner",
              "model": "gemini-2.5-pro"
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`
      `;

      expect(() => TaskParser.extractTaskMap(messageContent)).toThrow(
        /Task map validation failed/
      );
    });
  });

  describe('isValidStageName', () => {
    it('should return true for valid stage names', () => {
      expect(TaskParser.isValidStageName('IMPLEMENTATION')).toBe(true);
      expect(TaskParser.isValidStageName('CODE_REVIEW')).toBe(true);
      expect(TaskParser.isValidStageName('SYNTHESIZE')).toBe(true);
      expect(TaskParser.isValidStageName('PLAN_REVIEW')).toBe(true);
    });

    it('should return false for invalid stage names', () => {
      expect(TaskParser.isValidStageName('INVALID')).toBe(false);
      expect(TaskParser.isValidStageName('implementation')).toBe(false);
      expect(TaskParser.isValidStageName('')).toBe(false);
    });
  });

  describe('extractJsonFromText', () => {
    it('should extract JSON from markdown code block', () => {
      const text = `
Here's the JSON:
\`\`\`json
{"key": "value"}
\`\`\`
      `;

      const result = TaskParser.extractJsonFromText(text);
      expect(result).toBe('{"key": "value"}');
    });

    it('should extract standalone JSON', () => {
      const text = '{"key": "value"}';
      const result = TaskParser.extractJsonFromText(text);
      expect(result).toBe('{"key": "value"}');
    });

    it('should return null when no JSON found', () => {
      const text = 'Just some text without JSON';
      const result = TaskParser.extractJsonFromText(text);
      expect(result).toBeNull();
    });

    it('should handle JSON with trailing commas', () => {
      const text = `
\`\`\`json
{
  "key": "value",
}
\`\`\`
      `;

      const result = TaskParser.extractJsonFromText(text);
      expect(result).not.toBeNull();
      expect(() => JSON.parse(result!)).not.toThrow();
    });
  });
});
