/**
 * POST /storyboards/{id}/blocks/{blockId}/chat — Block-scoped AI chat.
 * 
 * Context injection: block summary + key code snippets + symbol table.
 * Grounded responses with file/symbol citations.
 */
import { getItem, putItem, queryItems } from '../lib/dynamo.js';
import { getText } from '../lib/s3.js';
import { invokeChat } from '../lib/bedrock.js';
import { PROMPTS } from '../lib/prompts.js';
import { success, error, parseBody } from '../shared/response.js';

const STORYBOARDS_TABLE = process.env.STORYBOARDS_TABLE;
const CHAT_TABLE = process.env.CHAT_TABLE;

export const handler = async (event) => {
    try {
        const storyboardId = event.pathParameters?.id;
        const blockId = event.pathParameters?.blockId;
        if (!storyboardId || !blockId) return error('Missing storyboard or block id', 400);

        const body = parseBody(event);
        const { message, userId = 'anonymous' } = body;
        if (!message) return error('message is required', 400);

        // Get block data
        const block = await getItem(STORYBOARDS_TABLE, { storyboardId, blockId });
        if (!block) return error('Block not found', 404);

        // Build context
        const blockSummary = `## ${block.title}\n**Objective:** ${block.objective}\n\n${block.explanationMarkdown}`;

        // Get key code snippets
        const codeSnippets = [];
        for (const filePath of (block.keyFiles || []).slice(0, 3)) {
            const repoId = block.repoId;
            const content = await getText(`repos/${repoId}/files/${filePath}`);
            if (content) {
                const truncated = content.split('\n').slice(0, 100).join('\n');
                codeSnippets.push(`### ${filePath}\n\`\`\`\n${truncated}\n\`\`\``);
            }
        }
        const keyCode = codeSnippets.join('\n\n') || 'No source files available for this block.';

        // Build symbol table
        const symbolTable = (block.keySymbols || [])
            .map(s => `- \`${s}\``)
            .join('\n') || 'No symbols indexed.';

        // Get chat history
        const chatKey = `${userId}#${storyboardId}#${blockId}`;
        const history = await queryItems(
            CHAT_TABLE,
            'chatKey = :ck',
            { ':ck': chatKey },
            { ScanIndexForward: true, Limit: 20 }
        );

        // Build messages array for Bedrock
        // Sanitize history: Bedrock requires alternating user/assistant starting with user
        const rawHistory = history.map(h => ({
            role: h.role,
            content: h.content,
        }));
        const sanitized = [];
        for (const msg of rawHistory) {
            const lastRole = sanitized.length > 0 ? sanitized[sanitized.length - 1].role : null;
            // Skip if same role as previous (would violate alternation)
            if (msg.role === lastRole) continue;
            sanitized.push(msg);
        }
        // Ensure history starts with a user message
        while (sanitized.length > 0 && sanitized[0].role !== 'user') {
            sanitized.shift();
        }
        // Ensure history ends with an assistant message before appending the new user message
        if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === 'user') {
            sanitized.pop();
        }
        const messages = [...sanitized, { role: 'user', content: message }];

        // Build system prompt with context
        const systemPrompt = PROMPTS.BLOCK_CHAT.system(blockSummary, keyCode, symbolTable);

        // Call Bedrock
        const aiResponse = await invokeChat(systemPrompt, messages);

        // Store both messages
        const timestamp = new Date().toISOString();
        await putItem(CHAT_TABLE, {
            chatKey,
            timestamp: `${timestamp}-user`,
            role: 'user',
            content: message,
        });
        await putItem(CHAT_TABLE, {
            chatKey,
            timestamp: `${timestamp}-assistant`,
            role: 'assistant',
            content: aiResponse,
        });

        return success({
            blockId,
            response: aiResponse,
            messageCount: messages.length + 1,
        });

    } catch (err) {
        console.error('Chat error:', err);
        return error(`Chat failed: ${err.message}`, 500);
    }
};
