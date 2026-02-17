/**
 * POST /repos/{id}/parse — Parse repository files into AST + module graph.
 */
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { getItem, updateItem } from '../lib/dynamo.js';
import { getJson, listObjects, getText, uploadJson } from '../lib/s3.js';
import { parseFiles } from '../lib/parser.js';
import { success, error } from '../shared/response.js';

const REPOS_TABLE = process.env.REPOS_TABLE;
const FILE_DOWNLOAD_BATCH_SIZE = 30;
const MODULE_UPLOAD_BATCH_SIZE = 40;
const PARSE_ASYNC_EVENT_SOURCE = 'forge.repo.parse';

const lambdaClient = new LambdaClient({});

export const handler = async (event) => {
    if (isAsyncParseInvocation(event)) {
        return await handleAsyncParseInvocation(event);
    }

    return await handleParseHttpRequest(event);
};

function isAsyncParseInvocation(event) {
    return event?.source === PARSE_ASYNC_EVENT_SOURCE;
}

async function handleParseHttpRequest(event) {
    try {
        const repoId = event.pathParameters?.id;
        if (!repoId) return error('Missing repo id', 400);

        const repo = await getItem(REPOS_TABLE, { repoId });
        if (!repo) return error('Repo not found', 404);

        if (repo.status === 'PARSING') {
            return success({
                repoId,
                status: 'PARSING',
                inProgress: true,
            }, 202);
        }

        if (repo.status === 'GENERATING_STORYBOARD') {
            return error('Cannot parse while storyboard generation is in progress', 409);
        }

        if (repo.status === 'PARSED' && repo.commitSha) {
            const cached = await getCachedParseResult(repoId);
            if (cached) {
                return success({ repoId, status: 'PARSED', cached: true, ...cached.stats });
            }
        }

        if (!['UPLOADED', 'PARSED', 'ERROR'].includes(repo.status)) {
            return error('Repo must be uploaded before parsing', 400);
        }

        await updateItem(REPOS_TABLE, { repoId }, {
            status: 'PARSING',
            errorMessage: null,
            parseRequestedAt: new Date().toISOString(),
        });

        try {
            await enqueueParse(repoId);
        } catch (err) {
            await markParseFailure(repoId, err);
            throw err;
        }

        return success({
            repoId,
            status: 'PARSING',
            inProgress: true,
            queued: true,
        }, 202);
    } catch (err) {
        console.error('ParseRepo enqueue error:', err);
        return error(`Parse failed: ${err.message}`, 500);
    }
}

async function handleAsyncParseInvocation(event) {
    const repoId = typeof event?.repoId === 'string' ? event.repoId : '';
    if (!repoId) {
        console.error('ParseRepo async invocation missing repoId');
        return { ok: false, reason: 'missing_repo_id' };
    }

    try {
        const repo = await getItem(REPOS_TABLE, { repoId });
        if (!repo) {
            throw new Error(`Repo not found for async parse: ${repoId}`);
        }

        if (repo.status === 'GENERATING_STORYBOARD') {
            throw new Error('Cannot parse while storyboard generation is in progress');
        }

        if (repo.status === 'PARSED' && repo.commitSha) {
            const cached = await getCachedParseResult(repoId);
            if (cached) {
                return { ok: true, repoId, status: 'PARSED', cached: true, ...cached.stats };
            }
        }

        if (repo.status !== 'PARSING') {
            await updateItem(REPOS_TABLE, { repoId }, {
                status: 'PARSING',
                errorMessage: null,
            });
        }

        const moduleGraph = await parseAndPersistRepo(repoId);
        const parsedAt = new Date().toISOString();

        await updateItem(REPOS_TABLE, { repoId }, {
            status: 'PARSED',
            moduleCount: moduleGraph.stats.totalModules,
            edgeCount: moduleGraph.stats.totalEdges,
            groupCount: moduleGraph.stats.totalGroups,
            parsedAt,
            errorMessage: null,
        });

        return {
            ok: true,
            repoId,
            status: 'PARSED',
            parsedAt,
            ...moduleGraph.stats,
        };
    } catch (err) {
        console.error('ParseRepo async worker error:', err);
        await markParseFailure(repoId, err);
        return { ok: false, repoId, error: err.message };
    }
}

async function enqueueParse(repoId) {
    const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
    if (!functionName) {
        throw new Error('Missing AWS_LAMBDA_FUNCTION_NAME; cannot enqueue parse');
    }

    const payload = {
        source: PARSE_ASYNC_EVENT_SOURCE,
        repoId,
    };

    await lambdaClient.send(new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify(payload)),
    }));
}

async function markParseFailure(repoId, err) {
    if (!repoId) return;

    try {
        await updateItem(REPOS_TABLE, { repoId }, {
            status: 'ERROR',
            errorMessage: err?.message || 'Parse failed',
        });
    } catch (updateErr) {
        console.error('Failed to persist parse failure state:', updateErr);
    }
}

async function getCachedParseResult(repoId) {
    const cached = await getJson(`repos/${repoId}/parsed/module-graph.json`);
    if (!cached || typeof cached !== 'object') return null;
    if (!cached.stats || typeof cached.stats !== 'object') return null;
    return cached;
}

async function parseAndPersistRepo(repoId) {
    const fileObjects = await listObjects(`repos/${repoId}/files/`);

    const files = [];
    for (let i = 0; i < fileObjects.length; i += FILE_DOWNLOAD_BATCH_SIZE) {
        const batch = fileObjects.slice(i, i + FILE_DOWNLOAD_BATCH_SIZE);
        const batchResults = await Promise.all(
            batch.map(async (obj) => {
                const relativePath = obj.key.replace(`repos/${repoId}/files/`, '');
                if (!relativePath) return null;
                const content = await getText(obj.key);
                if (!content) return null;
                return { path: relativePath, content };
            }),
        );

        for (const file of batchResults) {
            if (file) files.push(file);
        }
    }

    const moduleGraph = parseFiles(files);

    await uploadJson(`repos/${repoId}/parsed/module-graph.json`, moduleGraph);

    for (let i = 0; i < moduleGraph.modules.length; i += MODULE_UPLOAD_BATCH_SIZE) {
        const batch = moduleGraph.modules.slice(i, i + MODULE_UPLOAD_BATCH_SIZE);
        await Promise.all(
            batch.map((mod) => {
                const safeKey = mod.path.replace(/\//g, '__');
                return uploadJson(`repos/${repoId}/parsed/modules/${safeKey}.json`, mod);
            }),
        );
    }

    return moduleGraph;
}
