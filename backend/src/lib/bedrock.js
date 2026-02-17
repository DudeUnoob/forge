import {
    BedrockRuntimeClient,
    ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({});
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'amazon.nova-2-lite-v1:0';

function toConverseMessage(message) {
    const role = message?.role === 'assistant' ? 'assistant' : 'user';
    const text = typeof message?.content === 'string'
        ? message.content
        : String(message?.content || '');

    return {
        role,
        content: [{ text }],
    };
}

function extractResponseText(response) {
    const content = response?.output?.message?.content;
    if (!Array.isArray(content)) return '';

    return content
        .map((item) => (typeof item?.text === 'string' ? item.text : ''))
        .join('\n')
        .trim();
}

/**
 * Invoke a Bedrock model with a system prompt and one user message.
 * @param {string} systemPrompt - System-level instructions
 * @param {string} userMessage - User message / task
 * @param {object} options - { maxTokens, temperature }
 * @returns {Promise<string>} - The model's text response
 */
export async function invokeModel(systemPrompt, userMessage, options = {}) {
    const { maxTokens = 4096, temperature = 0.3 } = options;

    const result = await client.send(new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: systemPrompt }],
        messages: [{ role: 'user', content: [{ text: userMessage }] }],
        inferenceConfig: {
            maxTokens,
            temperature,
        },
    }));

    return extractResponseText(result);
}

/**
 * Invoke a Bedrock model with multi-turn chat history.
 * @param {string} systemPrompt
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options
 * @returns {Promise<string>}
 */
export async function invokeChat(systemPrompt, messages, options = {}) {
    const { maxTokens = 4096, temperature = 0.3 } = options;

    const result = await client.send(new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: systemPrompt }],
        messages: (messages || []).map(toConverseMessage),
        inferenceConfig: {
            maxTokens,
            temperature,
        },
    }));

    return extractResponseText(result);
}
