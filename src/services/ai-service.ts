'use server';

import { analyzeCodebaseForPotentialIssues, AnalyzeCodebaseForPotentialIssuesInput } from '@/ai/flows/analyze-codebase-for-issues';
import { orchestrateAgentConversation, OrchestrateAgentConversationInput } from '@/ai/flows/orchestrate-agent-conversation';
import { generateResponse as generateAgentResponseStream, GenerateAgentResponseInput } from '@/ai/flows/generate-agent-response';
import { getRepoContents as getRepoContentsFromGit, getFileContent } from '@/services/git-service';
import { Settings, CodebaseFile } from '@/lib/types';
import { enhanceUserPrompt, EnhanceUserPromptInput, EnhancedPrompt } from '@/ai/flows/enhance-user-prompt';
import { GITHUB_API_FILE_SIZE_LIMIT, IGNORE_PATTERNS } from '@/lib/agents';


export async function analyzeCodebase(input: AnalyzeCodebaseForPotentialIssuesInput) {
    return await analyzeCodebaseForPotentialIssues(input);
}

export async function orchestrateConversation(input: OrchestrateAgentConversationInput) {
    return await orchestrateAgentConversation(input);
}

export async function generateResponse(input: GenerateAgentResponseInput) {
    return generateAgentResponseStream(input);
}

export async function getRepoTree(repoUrl: string, settings: Settings): Promise<CodebaseFile[]> {
    const repoData = await getRepoContentsFromGit(repoUrl, settings);
    if (!repoData || !repoData.tree) {
        throw new Error("Could not retrieve repository tree. The repository might be private, or the URL is incorrect.");
    }
    
    const filesToFetch = repoData.tree.filter((file: any) => 
        file.type === 'blob' && 
        file.size < GITHUB_API_FILE_SIZE_LIMIT &&
        !IGNORE_PATTERNS.some(pattern => file.path.includes(pattern))
    );

    const fileContents = await Promise.all(
        filesToFetch.map(async (file: any) => {
            try {
                const content = await getFileContent(file.url, settings);
                return {
                    path: file.path,
                    content: content,
                };
            } catch (error) {
                console.warn(`Skipping file ${file.path} due to error:`, error);
                return null;
            }
        })
    );

    return fileContents.filter((file): file is CodebaseFile => file !== null);
}

export async function enhancePrompt(input: EnhanceUserPromptInput): Promise<EnhancedPrompt> {
    return await enhanceUserPrompt(input);
}
