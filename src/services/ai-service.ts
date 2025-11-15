'use server';

import { analyzeCodebaseForPotentialIssues, AnalyzeCodebaseForPotentialIssuesInput } from '@/ai/flows/analyze-codebase-for-issues';
import { orchestrateAgentConversation, OrchestrateAgentConversationInput } from '@/ai/flows/orchestrate-agent-conversation';
import { generateAgentResponse, GenerateAgentResponseInput } from '@/ai/flows/generate-agent-response';
import { getRepoContents as getRepoContentsFromGit } from '@/services/git-service';
import { Settings } from '@/lib/types';


export async function analyzeCodebase(input: AnalyzeCodebaseForPotentialIssuesInput) {
    return await analyzeCodebaseForPotentialIssues(input);
}

export async function orchestrateConversation(input: OrchestrateAgentConversationInput) {
    return await orchestrateAgentConversation(input);
}

export async function generateResponse(input: GenerateAgentResponseInput) {
    return await generateAgentResponse(input);
}

export async function getRepoTree(repoUrl: string, settings: Settings) {
    const repoData = await getRepoContentsFromGit(repoUrl, settings);
    if (!repoData || !repoData.tree) {
        throw new Error("Could not retrieve repository tree. The repository might be private, or the URL is incorrect.");
    }
    // The slice was the source of the original bug. Let's return the tree.
    return repoData.tree;
}
