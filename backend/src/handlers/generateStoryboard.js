/**
 * POST /repos/{id}/storyboard — Generate a storyboard using Bedrock.
 * 
 * Flow:
 * 1. Read module graph + commit history from DynamoDB/S3
 * 2. Call Bedrock to decompose into ordered blocks
 * 3. For each block, call Bedrock to generate detailed content
 * 4. Store storyboard in DynamoDB + diagrams in S3
 */
import { v4 as uuid } from 'uuid';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { getItem, updateItem, putItem } from '../lib/dynamo.js';
import { getJson, getText, uploadJson, uploadText } from '../lib/s3.js';
import { invokeModel } from '../lib/bedrock.js';
import { PROMPTS } from '../lib/prompts.js';
import { success, error, parseBody } from '../shared/response.js';

const REPOS_TABLE = process.env.REPOS_TABLE;
const STORYBOARDS_TABLE = process.env.STORYBOARDS_TABLE;
const MAX_PROMPT_CHARS = 150000; // Stay within model context window limits
const MAX_BLOCKS_TO_GENERATE = 10;
const DETAIL_GENERATION_CONCURRENCY = clampNumber(process.env.STORYBOARD_DETAIL_CONCURRENCY, 3, 1, 6);
const MAX_KEY_FILES_PER_BLOCK = 4;
const MAX_FILE_SNIPPET_LINES = 120;
const MAX_FILE_SNIPPET_CHARS = 12000;
const MAX_BLOCK_FILE_CONTEXT_CHARS = 40000;
const COMMIT_HISTORY_LIMIT = 12;
const COMMIT_MESSAGE_MAX_CHARS = 180;
const STORYBOARD_ASYNC_EVENT_SOURCE = 'forge.storyboard.generate';

const lambdaClient = new LambdaClient({});

/**
 * Compress a module graph to essential structure only, removing verbose content
 * to fit within model context limits while preserving relationships.
 */
function compressModuleGraph(moduleGraph) {
    const compressed = {
        stats: moduleGraph.stats,
        groups: moduleGraph.groups,
        edges: moduleGraph.edges,
        modules: (moduleGraph.modules || []).map(mod => ({
            path: mod.path,
            language: mod.language,
            imports: mod.imports,
            exports: mod.exports,
            // Keep only top-level symbol names, not full bodies
            classes: (mod.classes || []).map(c => c.name || c),
            functions: (mod.functions || []).map(f => f.name || f),
        })),
    };

    // If still too large, further reduce by trimming modules list
    let json = JSON.stringify(compressed);
    if (json.length > MAX_PROMPT_CHARS * 0.6) {
        // Drop function/class lists and keep only paths + edges
        compressed.modules = compressed.modules.map(mod => ({
            path: mod.path,
            language: mod.language,
            imports: mod.imports,
            exports: mod.exports,
        }));
        json = JSON.stringify(compressed);
    }

    return compressed;
}

export const handler = async (event) => {
    if (isAsyncStoryboardInvocation(event)) {
        return await handleAsyncStoryboardInvocation(event);
    }

    return await handleStoryboardHttpRequest(event);
};

function isAsyncStoryboardInvocation(event) {
    return event?.source === STORYBOARD_ASYNC_EVENT_SOURCE;
}

async function handleStoryboardHttpRequest(event) {
    try {
        const repoId = event.pathParameters?.id;
        if (!repoId) return error('Missing repo id', 400);

        const body = parseBody(event);
        const role = typeof body.role === 'string' && body.role.trim() ? body.role.trim() : 'fullstack';

        const repo = await getItem(REPOS_TABLE, { repoId });
        if (!repo) return error('Repo not found', 404);

        if (repo.storyboardId) {
            return success({
                storyboardId: repo.storyboardId,
                repoId,
                blockCount: repo.storyboardBlockCount || 0,
                cached: true,
            });
        }

        if (repo.status === 'GENERATING_STORYBOARD') {
            return success({
                repoId,
                status: 'GENERATING_STORYBOARD',
                inProgress: true,
                storyboardId: repo.storyboardId || null,
                storyboardErrorMessage: repo.storyboardErrorMessage || null,
            }, 202);
        }

        if (repo.status !== 'PARSED') return error('Repo must be parsed first', 400);

        await updateItem(REPOS_TABLE, { repoId }, {
            status: 'GENERATING_STORYBOARD',
            storyboardErrorMessage: null,
            storyboardRequestedAt: new Date().toISOString(),
        });

        try {
            await enqueueStoryboardGeneration(repoId, role);
        } catch (err) {
            await markStoryboardFailure(repoId, err);
            throw err;
        }

        const isLocal = Boolean(process.env.AWS_SAM_LOCAL || process.env.IS_LOCAL);
        return success({
            repoId,
            status: isLocal ? 'GENERATED_STORYBOARD' : 'GENERATING_STORYBOARD', // Assuming frontend looks for a completion state or just refetches
            inProgress: !isLocal,
            queued: !isLocal,
            storyboardId: null,
        }, 202);
    } catch (err) {
        console.error('GenerateStoryboard enqueue error:', err);
        return error(`Storyboard generation failed: ${err.message}`, 500);
    }
}

async function handleAsyncStoryboardInvocation(event) {
    const repoId = typeof event?.repoId === 'string' ? event.repoId : '';
    if (!repoId) {
        console.error('GenerateStoryboard async invocation missing repoId');
        return { ok: false, reason: 'missing_repo_id' };
    }

    const role = typeof event?.role === 'string' && event.role.trim() ? event.role.trim() : 'fullstack';

    try {
        const repo = await getItem(REPOS_TABLE, { repoId });
        if (!repo) {
            throw new Error(`Repo not found for async generation: ${repoId}`);
        }

        if (repo.storyboardId) {
            return { ok: true, repoId, storyboardId: repo.storyboardId, cached: true };
        }

        if (repo.status !== 'GENERATING_STORYBOARD') {
            await updateItem(REPOS_TABLE, { repoId }, {
                status: 'GENERATING_STORYBOARD',
                storyboardErrorMessage: null,
            });
        }

        const generated = await generateStoryboardForRepo(repoId, role);
        return { ok: true, ...generated };
    } catch (err) {
        console.error('GenerateStoryboard async worker error:', err);
        await markStoryboardFailure(repoId, err);
        return { ok: false, repoId, error: err.message };
    }
}

async function enqueueStoryboardGeneration(repoId, role) {
    if (process.env.AWS_SAM_LOCAL || process.env.IS_LOCAL) {
        await handleAsyncStoryboardInvocation({ source: STORYBOARD_ASYNC_EVENT_SOURCE, repoId, role });
        return;
    }

    const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
    if (!functionName) {
        throw new Error('Missing AWS_LAMBDA_FUNCTION_NAME; cannot enqueue storyboard generation');
    }

    const payload = {
        source: STORYBOARD_ASYNC_EVENT_SOURCE,
        repoId,
        role,
    };

    await lambdaClient.send(new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify(payload)),
    }));
}

async function markStoryboardFailure(repoId, err) {
    if (!repoId) return;

    try {
        await updateItem(REPOS_TABLE, { repoId }, {
            status: 'PARSED',
            storyboardErrorMessage: err?.message || 'Storyboard generation failed',
        });
    } catch (updateErr) {
        console.error('Failed to persist storyboard failure state:', updateErr);
    }
}

async function generateStoryboardForRepo(repoId, role) {
    const moduleGraph = await getJson(`repos/${repoId}/parsed/module-graph.json`);
    if (!moduleGraph) {
        throw new Error('Module graph not found — parse the repo first');
    }

    const compressedGraph = compressModuleGraph(moduleGraph);

    const metadata = await getJson(`repos/${repoId}/metadata.json`);
    const fileList = (metadata?.fileList || []).slice(0, 300);
    const commitHistory = (metadata?.commitHistory || []).slice(0, COMMIT_HISTORY_LIMIT);

    const commitHistoryText = commitHistory
        .map(c => {
            const shortSha = typeof c.sha === 'string' ? c.sha.slice(0, 7) : 'unknown';
            const message = truncateText(typeof c.message === 'string' ? c.message : '', COMMIT_MESSAGE_MAX_CHARS);
            const author = typeof c.author === 'string' ? c.author : 'unknown';
            const date = typeof c.date === 'string' ? c.date : 'unknown';
            return `${shortSha} — ${message} (${author}, ${date})`;
        })
        .join('\n');

    const storyboardId = uuid();

    const decompositionPrompt = PROMPTS.DECOMPOSE_SYSTEM;
    const blockListRaw = await invokeModelWithRetry(
        decompositionPrompt.system,
        decompositionPrompt.user(compressedGraph, fileList, commitHistoryText),
        { maxTokens: 4096, temperature: 0.2 }
    );

    let blockList = parseModelJson(blockListRaw, 'array');
    if (!blockList) {
        const blockObj = parseModelJson(blockListRaw, 'object');
        if (blockObj && Array.isArray(blockObj.blocks)) {
            blockList = blockObj.blocks;
        }
    }
    if (!Array.isArray(blockList) || blockList.length === 0) {
        throw new Error('Failed to parse AI block decomposition');
    }

    const normalizedBlockList = normalizeBlockList(blockList).slice(0, MAX_BLOCKS_TO_GENERATE);
    if (normalizedBlockList.length === 0) {
        throw new Error('No valid storyboard blocks were generated');
    }

    const detailPrompt = PROMPTS.GENERATE_BLOCK_DETAIL;
    const blockLookup = new Map(normalizedBlockList.map(block => [block.blockId, block]));
    const snippetCache = new Map();

    const blocks = await mapWithConcurrency(
        normalizedBlockList,
        DETAIL_GENERATION_CONCURRENCY,
        async (blockSkeleton, index) => {
            const fileContents = await buildBlockFileContext(repoId, blockSkeleton.keyFiles, snippetCache);
            const depContext = buildDependencyContext(blockSkeleton.prerequisites, blockLookup);
            const detailRaw = await invokeModelWithRetry(
                detailPrompt.system,
                detailPrompt.user(blockSkeleton, fileContents, depContext),
                { maxTokens: 4096, temperature: 0.3 }
            );

            const parsedDetail = parseModelJson(detailRaw, 'object');
            const blockDetail = parsedDetail && typeof parsedDetail === 'object' && !Array.isArray(parsedDetail)
                ? parsedDetail
                : {
                    blockId: blockSkeleton.blockId,
                    title: blockSkeleton.title,
                    objective: blockSkeleton.objective,
                    explanationMarkdown: detailRaw,
                    dependencySummary: '',
                    mermaidDiagram: '',
                    keyTakeaways: [],
                    suggestedQuestions: [],
                };

            if (!blockDetail.explanationMarkdown) {
                blockDetail.explanationMarkdown = '';
            }

            const diagramRefs = [];
            if (blockDetail.mermaidDiagram) {
                const diagramKey = `repos/${repoId}/diagrams/${blockSkeleton.blockId}.mmd`;
                await uploadText(diagramKey, blockDetail.mermaidDiagram, 'text/plain');
                diagramRefs.push(diagramKey);
            }

            const block = {
                storyboardId,
                blockId: blockSkeleton.blockId,
                repoId,
                title: blockDetail.title || blockSkeleton.title,
                roleTags: blockSkeleton.roleTags || ['fullstack'],
                objective: blockDetail.objective || blockSkeleton.objective,
                explanationMarkdown: blockDetail.explanationMarkdown || '',
                prerequisites: blockSkeleton.prerequisites || [],
                next: normalizedBlockList[index + 1] ? [normalizedBlockList[index + 1].blockId] : [],
                keyFiles: blockSkeleton.keyFiles || [],
                keySymbols: blockSkeleton.keySymbols || [],
                dependencySummary: blockDetail.dependencySummary || '',
                diagramRefs,
                mermaidDiagram: blockDetail.mermaidDiagram || '',
                resources: blockDetail.resources || [],
                keyTakeaways: blockDetail.keyTakeaways || [],
                suggestedQuestions: blockDetail.suggestedQuestions || [],
                order: index,
                estimatedMinutes: blockSkeleton.estimatedMinutes || 10,
                generatedAt: new Date().toISOString(),
            };

            await putItem(STORYBOARDS_TABLE, block);
            return block;
        },
    );

    blocks.sort((a, b) => a.order - b.order);

    await uploadJson(`repos/${repoId}/storyboards/${storyboardId}.json`, {
        storyboardId,
        repoId,
        role,
        blockCount: blocks.length,
        generatedAt: new Date().toISOString(),
    });

    const generatedAt = new Date().toISOString();
    await updateItem(REPOS_TABLE, { repoId }, {
        status: 'PARSED',
        storyboardId,
        storyboardBlockCount: blocks.length,
        storyboardGeneratedAt: generatedAt,
        storyboardErrorMessage: null,
    });

    return {
        repoId,
        storyboardId,
        blockCount: blocks.length,
        generatedAt,
        blocks: blocks.map(b => ({
            blockId: b.blockId,
            title: b.title,
            objective: b.objective,
            order: b.order,
            roleTags: b.roleTags,
        })),
    };
}

function normalizeBlockList(rawBlocks) {
    const usedIds = new Set();

    return rawBlocks.map((rawBlock, index) => {
        const source = (typeof rawBlock === 'object' && rawBlock !== null) ? rawBlock : {};
        const fallbackId = `block-${index + 1}`;
        const proposedId = truncateText(String(source.blockId || fallbackId).trim(), 64) || fallbackId;
        const blockId = ensureUniqueBlockId(proposedId, usedIds, fallbackId);

        const title = truncateText(
            typeof source.title === 'string' && source.title.trim()
                ? source.title.trim()
                : `Block ${index + 1}`,
            120,
        );
        const objective = truncateText(
            typeof source.objective === 'string' ? source.objective.trim() : '',
            320,
        );

        return {
            ...source,
            blockId,
            title: title || `Block ${index + 1}`,
            objective,
            roleTags: normalizeRoleTags(source.roleTags),
            keyFiles: normalizePathList(source.keyFiles),
            keySymbols: normalizeStringList(source.keySymbols, 60),
            prerequisites: normalizeStringList(source.prerequisites, 32),
            estimatedMinutes: normalizeEstimatedMinutes(source.estimatedMinutes),
        };
    });
}

function ensureUniqueBlockId(candidate, usedIds, fallbackId) {
    let normalized = candidate || fallbackId;
    let suffix = 1;

    while (usedIds.has(normalized)) {
        normalized = `${candidate || fallbackId}-${suffix}`;
        suffix += 1;
    }

    usedIds.add(normalized);
    return normalized;
}

function normalizeRoleTags(rawRoleTags) {
    const tags = normalizeStringList(rawRoleTags, 24);
    return tags.length > 0 ? tags : ['fullstack'];
}

function normalizePathList(rawPaths) {
    return normalizeStringList(rawPaths, 260)
        .map(path => path.replace(/^\/+/, '').replace(/\\/g, '/'))
        .filter(Boolean);
}

function normalizeStringList(rawValues, maxValueLength) {
    if (!Array.isArray(rawValues)) return [];

    const seen = new Set();
    const results = [];
    for (const rawValue of rawValues) {
        if (typeof rawValue !== 'string') continue;
        const value = truncateText(rawValue.trim(), maxValueLength);
        if (!value || seen.has(value)) continue;
        seen.add(value);
        results.push(value);
    }

    return results;
}

function normalizeEstimatedMinutes(rawValue) {
    const parsed = Number.parseInt(String(rawValue), 10);
    if (Number.isNaN(parsed)) return 10;
    return Math.min(60, Math.max(3, parsed));
}

function buildDependencyContext(prerequisites, blockLookup) {
    const lines = (Array.isArray(prerequisites) ? prerequisites : [])
        .map((preId) => {
            const pre = blockLookup.get(preId);
            return pre ? `- ${pre.blockId}: ${pre.title} — ${pre.objective}` : '';
        })
        .filter(Boolean);

    return lines.length > 0
        ? lines.join('\n')
        : 'This is a foundational block with no prerequisites.';
}

async function buildBlockFileContext(repoId, keyFiles, snippetCache) {
    const selectedFiles = Array.isArray(keyFiles)
        ? keyFiles.slice(0, MAX_KEY_FILES_PER_BLOCK)
        : [];

    if (selectedFiles.length === 0) return '';

    const snippets = await Promise.all(
        selectedFiles.map(filePath => getCachedFileSnippet(repoId, filePath, snippetCache)),
    );

    return snippets
        .filter(Boolean)
        .join('\n\n')
        .slice(0, MAX_BLOCK_FILE_CONTEXT_CHARS);
}

async function getCachedFileSnippet(repoId, filePath, snippetCache) {
    const cacheKey = `${repoId}:${filePath}`;
    const cached = snippetCache.get(cacheKey);
    if (cached) {
        return await cached;
    }

    const loadPromise = (async () => {
        const content = await getText(`repos/${repoId}/files/${filePath}`);
        if (!content) {
            return '';
        }

        const truncated = truncateFileForPrompt(content);
        const fence = getCodeFence(truncated);
        return `### ${filePath}\n${fence}\n${truncated}\n${fence}`;
    })();

    snippetCache.set(cacheKey, loadPromise);

    try {
        const snippet = await loadPromise;
        snippetCache.set(cacheKey, Promise.resolve(snippet));
        return snippet;
    } catch (err) {
        snippetCache.delete(cacheKey);
        throw err;
    }
}

function truncateFileForPrompt(content) {
    if (typeof content !== 'string' || content.length === 0) return '';

    const lines = content.split('\n').slice(0, MAX_FILE_SNIPPET_LINES);
    const joined = lines.join('\n');
    if (joined.length <= MAX_FILE_SNIPPET_CHARS) return joined;
    return `${joined.slice(0, MAX_FILE_SNIPPET_CHARS)}\n...`;
}

function getCodeFence(code) {
    const matches = typeof code === 'string' ? code.match(/`+/g) : null;
    const maxRun = matches ? Math.max(...matches.map(s => s.length)) : 0;
    return '`'.repeat(Math.max(3, maxRun + 1));
}

function truncateText(value, maxChars) {
    if (typeof value !== 'string') return '';
    if (value.length <= maxChars) return value;
    return `${value.slice(0, Math.max(0, maxChars - 3))}...`;
}

function clampNumber(rawValue, fallback, min, max) {
    const parsed = Number.parseInt(String(rawValue ?? ''), 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

async function mapWithConcurrency(items, concurrency, mapper) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    const results = new Array(items.length);
    let nextIndex = 0;

    const worker = async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await mapper(items[currentIndex], currentIndex);
        }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

async function invokeModelWithRetry(systemPrompt, userPrompt, options, maxAttempts = 3) {
    let attempt = 0;

    while (attempt < maxAttempts) {
        try {
            return await invokeModel(systemPrompt, userPrompt, options);
        } catch (err) {
            const shouldRetry = isRetryableBedrockError(err) && attempt < maxAttempts - 1;
            if (!shouldRetry) throw err;

            const backoffMs = 500 * (2 ** attempt) + Math.floor(Math.random() * 250);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            attempt += 1;
        }
    }

    throw new Error('Model invocation failed after retries');
}

function isRetryableBedrockError(err) {
    const message = typeof err?.message === 'string' ? err.message.toLowerCase() : '';
    const name = typeof err?.name === 'string' ? err.name.toLowerCase() : '';
    return name.includes('throttl')
        || name.includes('timeout')
        || message.includes('throttl')
        || message.includes('rate exceed')
        || message.includes('timeout');
}

function parseModelJson(rawText, expectedType) {
    if (typeof rawText !== 'string') return null;

    const trimmed = rawText.trim();
    const defenced = stripMarkdownCodeFence(trimmed);
    const openChar = expectedType === 'array' ? '[' : '{';
    const candidates = [];

    const addCandidate = (value) => {
        if (typeof value !== 'string') return;
        const normalized = value.trim();
        if (!normalized) return;
        if (!candidates.includes(normalized)) {
            candidates.push(normalized);
        }
    };

    addCandidate(trimmed);
    addCandidate(defenced);
    addCandidate(extractJsonChunk(trimmed, openChar));
    addCandidate(extractJsonChunk(defenced, openChar));

    for (const candidate of candidates) {
        const parsed = tryParseJson(candidate);
        if (isExpectedJsonType(parsed, expectedType)) return parsed;

        const repaired = sanitizeJsonControlChars(candidate);
        if (repaired !== candidate) {
            const repairedParsed = tryParseJson(repaired);
            if (isExpectedJsonType(repairedParsed, expectedType)) return repairedParsed;
        }
    }

    return null;
}

function tryParseJson(candidate) {
    try {
        return JSON.parse(candidate);
    } catch {
        return null;
    }
}

function isExpectedJsonType(value, expectedType) {
    if (expectedType === 'array') return Array.isArray(value);
    if (expectedType === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    return false;
}

function stripMarkdownCodeFence(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
}

function extractJsonChunk(text, openChar) {
    if (typeof text !== 'string') return '';
    const closeChar = openChar === '[' ? ']' : '}';

    let start = text.indexOf(openChar);
    while (start !== -1) {
        const end = findMatchingCloseIndex(text, start, openChar, closeChar);
        if (end !== -1) {
            return text.slice(start, end + 1);
        }
        start = text.indexOf(openChar, start + 1);
    }

    return '';
}

function findMatchingCloseIndex(text, start, openChar, closeChar) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === openChar) {
            depth++;
            continue;
        }
        if (ch === closeChar) {
            depth--;
            if (depth === 0) return i;
            if (depth < 0) return -1;
        }
    }

    return -1;
}

function sanitizeJsonControlChars(input) {
    let output = '';
    let inString = false;
    let escaped = false;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        const code = ch.charCodeAt(0);

        if (inString) {
            if (escaped) {
                output += ch;
                escaped = false;
                continue;
            }
            if (ch === '\\') {
                output += ch;
                escaped = true;
                continue;
            }
            if (ch === '"') {
                output += ch;
                inString = false;
                continue;
            }
            if (ch === '\n') {
                output += '\\n';
                continue;
            }
            if (ch === '\r') {
                output += '\\r';
                continue;
            }
            if (ch === '\t') {
                output += '\\t';
                continue;
            }
            if (code < 0x20) {
                output += ' ';
                continue;
            }
            output += ch;
            continue;
        }

        if (ch === '"') {
            inString = true;
            output += ch;
            continue;
        }

        if (code < 0x20 && ch !== '\n' && ch !== '\r' && ch !== '\t') {
            continue;
        }

        output += ch;
    }

    return output;
}
