import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-git-history.ts';
import '@/ai/flows/analyze-codebase-for-issues.ts';
import '@/ai/flows/generate-project-readme.ts';
import '@/ai/flows/orchestrate-agent-conversation.ts';
import '@/ai/flows/generate-agent-response.ts';
