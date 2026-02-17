import {
    BedrockRuntimeClient,
    ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({});
const NOVA_2_LITE_MODEL_ID = 'amazon.nova-2-lite-v1:0';
const NOVA_2_LITE_PROFILE_ID = 'us.amazon.nova-2-lite-v1:0';
const DEFAULT_BEDROCK_TARGET = NOVA_2_LITE_PROFILE_ID;
let hasWarnedLegacyNovaModelId = false;
const MODEL_ID = normalizeBedrockTarget(process.env.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_TARGET);

function normalizeBedrockTarget(rawTarget) {
    const target = typeof rawTarget === 'string' ? rawTarget.trim() : '';
    if (!target) return DEFAULT_BEDROCK_TARGET;

    if (target === NOVA_2_LITE_MODEL_ID) {
        if (!hasWarnedLegacyNovaModelId) {
            hasWarnedLegacyNovaModelId = true;
            console.warn(
                `BEDROCK_MODEL_ID="${NOVA_2_LITE_MODEL_ID}" is a foundation model ID. ` +
                `Using inference profile "${NOVA_2_LITE_PROFILE_ID}" instead.`,
            );
        }
        return NOVA_2_LITE_PROFILE_ID;
    }

    return target;
}

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

function addInferenceProfileGuidance(err) {
    const message = typeof err?.message === 'string' ? err.message : '';
    if (!message.toLowerCase().includes('on-demand throughput')) {
        return err;
    }

    const improvedError = new Error(
        `${message} Use inference profile ID/ARN (e.g., "${NOVA_2_LITE_PROFILE_ID}") instead of foundation model ID "${NOVA_2_LITE_MODEL_ID}".`,
        { cause: err },
    );
    improvedError.name = err?.name || 'BedrockInvocationError';
    return improvedError;
}

async function sendConverse(params) {
    try {
        return await client.send(new ConverseCommand(params));
    } catch (err) {
        throw addInferenceProfileGuidance(err);
    }
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

    const result = await sendConverse({
        modelId: MODEL_ID,
        system: [{ text: systemPrompt }],
        messages: [{ role: 'user', content: [{ text: userMessage }] }],
        inferenceConfig: {
            maxTokens,
            temperature,
        },
    });

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

    const result = await sendConverse({
        modelId: MODEL_ID,
        system: [{ text: systemPrompt }],
        messages: (messages || []).map(toConverseMessage),
        inferenceConfig: {
            maxTokens,
            temperature,
        },
    });

    return extractResponseText(result);
}
