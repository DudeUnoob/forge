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
import { getItem, updateItem, putItem } from '../lib/dynamo.js';
import { getJson, getText, uploadJson, uploadText } from '../lib/s3.js';
import { invokeModel } from '../lib/bedrock.js';
import { PROMPTS } from '../lib/prompts.js';
import { success, error, parseBody } from '../shared/response.js';

const REPOS_TABLE = process.env.REPOS_TABLE;
const STORYBOARDS_TABLE = process.env.STORYBOARDS_TABLE;

export const handler = async (event) => {
    try {
        const repoId = event.pathParameters?.id;
        if (!repoId) return error('Missing repo id', 400);

        const body = parseBody(event);
        const role = body.role || 'fullstack';

        // Get repo metadata
        const repo = await getItem(REPOS_TABLE, { repoId });
        if (!repo) return error('Repo not found', 404);
        if (repo.status !== 'PARSED') return error('Repo must be parsed first', 400);

        // Get module graph
        const moduleGraph = await getJson(`repos/${repoId}/parsed/module-graph.json`);
        if (!moduleGraph) return error('Module graph not found — parse the repo first', 400);

        // Get repo metadata (file list & commit history)
        const metadata = await getJson(`repos/${repoId}/metadata.json`);
        const fileList = metadata?.fileList || [];
        const commitHistory = metadata?.commitHistory || [];

        const commitHistoryText = commitHistory
            .map(c => `${c.sha} — ${c.message} (${c.author}, ${c.date})`)
            .join('\n');

        // ---- Step 1: Decompose codebase into blocks ----
        const storyboardId = uuid();

        const decompositionPrompt = PROMPTS.DECOMPOSE_SYSTEM;
        const blockListRaw = await invokeModel(
            decompositionPrompt.system,
            decompositionPrompt.user(moduleGraph, fileList, commitHistoryText),
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
            return error('Failed to parse AI block decomposition', 500);
        }

        // ---- Step 2: Generate detailed content for each block ----
        const blocks = [];

        for (let i = 0; i < blockList.length; i++) {
            const blockSkeleton = (typeof blockList[i] === 'object' && blockList[i] !== null)
                ? blockList[i]
                : {};
            blockSkeleton.blockId = blockSkeleton.blockId || `block-${i + 1}`;
            blockSkeleton.title = blockSkeleton.title || `Block ${i + 1}`;
            blockSkeleton.objective = blockSkeleton.objective || '';

            // Gather file contents for this block's key files (truncated)
            const fileContentsArr = [];
            for (const filePath of (blockSkeleton.keyFiles || []).slice(0, 5)) {
                const content = await getText(`repos/${repoId}/files/${filePath}`);
                if (content) {
                    // Truncate to first 200 lines
                    const truncated = content.split('\n').slice(0, 200).join('\n');
                    fileContentsArr.push(`### ${filePath}\n\`\`\`\n${truncated}\n\`\`\``);
                }
            }
            const fileContents = fileContentsArr.join('\n\n');

            // Dependency context from prerequisites
            const depContext = (blockSkeleton.prerequisites || [])
                .map(preId => {
                    const pre = blockList.find(b => b.blockId === preId);
                    return pre ? `- ${pre.blockId}: ${pre.title} — ${pre.objective}` : '';
                })
                .filter(Boolean)
                .join('\n');

            const detailPrompt = PROMPTS.GENERATE_BLOCK_DETAIL;
            const detailRaw = await invokeModel(
                detailPrompt.system,
                detailPrompt.user(blockSkeleton, fileContents, depContext || 'This is a foundational block with no prerequisites.'),
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

            // Store Mermaid diagram in S3 if present
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
                next: blockList[i + 1] ? [blockList[i + 1].blockId] : [],
                keyFiles: blockSkeleton.keyFiles || [],
                keySymbols: blockSkeleton.keySymbols || [],
                dependencySummary: blockDetail.dependencySummary || '',
                diagramRefs,
                mermaidDiagram: blockDetail.mermaidDiagram || '',
                resources: blockDetail.resources || [],
                keyTakeaways: blockDetail.keyTakeaways || [],
                suggestedQuestions: blockDetail.suggestedQuestions || [],
                order: i,
                estimatedMinutes: blockSkeleton.estimatedMinutes || 10,
                generatedAt: new Date().toISOString(),
            };

            // Store in DynamoDB
            await putItem(STORYBOARDS_TABLE, block);
            blocks.push(block);
        }

        // Store full storyboard metadata
        await uploadJson(`repos/${repoId}/storyboards/${storyboardId}.json`, {
            storyboardId,
            repoId,
            role,
            blockCount: blocks.length,
            generatedAt: new Date().toISOString(),
        });

        // Update repo with storyboard reference
        await updateItem(REPOS_TABLE, { repoId }, {
            storyboardId,
            storyboardBlockCount: blocks.length,
            storyboardGeneratedAt: new Date().toISOString(),
        });

        return success({
            storyboardId,
            repoId,
            blockCount: blocks.length,
            blocks: blocks.map(b => ({
                blockId: b.blockId,
                title: b.title,
                objective: b.objective,
                order: b.order,
                roleTags: b.roleTags,
            })),
        }, 201);

    } catch (err) {
        console.error('GenerateStoryboard error:', err);
        return error(`Storyboard generation failed: ${err.message}`, 500);
    }
};

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
