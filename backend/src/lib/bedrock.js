import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({});
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';

/**
 * Invoke Claude via Bedrock with a structured prompt.
 * @param {string} systemPrompt - System-level instructions
 * @param {string} userMessage - User message / task
 * @param {object} options - { maxTokens, temperature }
 * @returns {Promise<string>} - The model's text response
 */
export async function invokeModel(systemPrompt, userMessage, options = {}) {
    const { maxTokens = 4096, temperature = 0.3 } = options;

    const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [
            { role: 'user', content: userMessage },
        ],
    };

    const result = await client.send(new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
    }));

    const response = JSON.parse(new TextDecoder().decode(result.body));
    return response.content[0].text;
}

/**
 * Invoke Claude with multi-turn chat history.
 * @param {string} systemPrompt
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} options
 * @returns {Promise<string>}
 */
export async function invokeChat(systemPrompt, messages, options = {}) {
    const { maxTokens = 4096, temperature = 0.3 } = options;

    const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages,
    };

    const result = await client.send(new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
    }));

    const response = JSON.parse(new TextDecoder().decode(result.body));
    return response.content[0].text;
}
