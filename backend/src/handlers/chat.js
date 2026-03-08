/**
 * POST /storyboards/{id}/blocks/{blockId}/chat — Block-scoped AI chat.
 * 
 * Context injection: block summary + key code snippets + symbol table.
 * Grounded responses with file/symbol citations.
 */
import { getItem, putItem, queryItems } from '../lib/dynamo.js';
import { getText } from '../lib/s3.js';
import { invokeChat } from '../lib/bedrock.js';
import { buildChatMessages } from '../lib/chatHistory.js';
import { PROMPTS } from '../lib/prompts.js';
import { success, error, parseBody } from '../shared/response.js';

const STORYBOARDS_TABLE = process.env.STORYBOARDS_TABLE;
const CHAT_TABLE = process.env.CHAT_TABLE;
const STARTS_WITH_USER_ERROR_PATTERN = /must start with a user message/i;

export const handler = async (event) => {
    try {
        const storyboardId = event.pathParameters?.id;
        const blockId = event.pathParameters?.blockId;
        if (!storyboardId || !blockId) return error('Missing storyboard or block id', 400);

        const body = parseBody(event);
        const { message, userId = 'anonymous' } = body;
        const userMessage = typeof message === 'string' ? message.trim() : String(message ?? '').trim();
        if (!userMessage) return error('message is required', 400);

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
            { ScanIndexForward: false, Limit: 20 }
        );

        const chronologicalHistory = [...history].reverse();
        const rawHistory = chronologicalHistory.map(h => ({
            role: h.role,
            content: h.content,
        }));
        const messages = buildChatMessages(rawHistory, userMessage);

        // Build system prompt with context
        const systemPrompt = PROMPTS.BLOCK_CHAT.system(blockSummary, keyCode, symbolTable);

        let aiResponse;
        let usedMessages = messages;

        try {
            aiResponse = await invokeChat(systemPrompt, usedMessages);
        } catch (err) {
            const messageText = typeof err?.message === 'string' ? err.message : '';
            if (!STARTS_WITH_USER_ERROR_PATTERN.test(messageText)) throw err;

            usedMessages = [{ role: 'user', content: userMessage }];
            console.warn('Chat history payload rejected by Bedrock. Retrying with current user message only.', {
                chatKey,
                storyboardId,
                blockId,
                attemptedMessageCount: messages.length,
            });
            aiResponse = await invokeChat(systemPrompt, usedMessages);
        }

        // Store both messages
        const userTimestamp = new Date().toISOString();
        const assistantTimestamp = new Date(Date.now() + 1).toISOString();
        await putItem(CHAT_TABLE, {
            chatKey,
            timestamp: userTimestamp,
            role: 'user',
            content: userMessage,
        });
        await putItem(CHAT_TABLE, {
            chatKey,
            timestamp: assistantTimestamp,
            role: 'assistant',
            content: aiResponse,
        });

        return success({
            blockId,
            response: aiResponse,
            messageCount: usedMessages.length + 1,
        });

    } catch (err) {
        console.error('Chat error:', err);
        return error(`Chat failed: ${err.message}`, 500);
    }
};
