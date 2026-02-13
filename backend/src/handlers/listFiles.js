/**
 * GET /repos/{id}/files — List file tree from S3
 * GET /repos/{id}/files/{path+} — Get single file content
 * POST /repos/{id}/files/batch — Get multiple file contents
 */
import { listObjects, getText } from '../lib/s3.js';
import { getItem } from '../lib/dynamo.js';
import { success, error, parseBody } from '../shared/response.js';

const REPOS_TABLE = process.env.REPOS_TABLE;
const FILE_CACHE_MAX_ENTRIES = 120;
const BATCH_FETCH_MAX_FILES = 25;
const fileContentCache = new Map();

export const handler = async (event) => {
    try {
        const repoId = event.pathParameters?.id;
        if (!repoId) return error('Missing repo id', 400);

        const method = event.requestContext?.http?.method || 'GET';
        if (method === 'POST') {
            return handleBatchFetch(repoId, event);
        }

        const rawFilePath = event.pathParameters?.path;
        const filePath = normalizePath(rawFilePath, { decode: true });
        if (rawFilePath && !filePath) return error('Invalid file path', 400);

        if (filePath) {
            // GET single file content
            const content = await getFileContent(repoId, filePath);
            if (content === null) return error('File not found', 404);

            return success({ path: filePath, content });
        }

        // Check repo exists for file tree listing
        const repo = await getItem(REPOS_TABLE, { repoId });
        if (!repo) return error('Repo not found', 404);

        // GET file tree
        const objects = await listObjects(`repos/${repoId}/files/`);
        const prefix = `repos/${repoId}/files/`;

        // Build tree structure
        const tree = buildTree(objects.map(o => o.key.replace(prefix, '')).filter(Boolean));

        return success({ repoId, tree });

    } catch (err) {
        console.error('ListFiles error:', err);
        return error(err.message, 500);
    }
};

function buildTree(paths) {
    const root = { name: '/', type: 'directory', children: [] };

    for (const filePath of paths) {
        const parts = filePath.split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;

            if (isFile) {
                current.children.push({ name: part, type: 'file', path: filePath });
            } else {
                let dir = current.children.find(c => c.name === part && c.type === 'directory');
                if (!dir) {
                    dir = { name: part, type: 'directory', children: [] };
                    current.children.push(dir);
                }
                current = dir;
            }
        }
    }

    // Sort: directories first, then files, alphabetically
    sortTree(root);
    return root;
}

function sortTree(node) {
    if (node.children) {
        node.children.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortTree);
    }
}

async function handleBatchFetch(repoId, event) {
    const body = parseBody(event);
    const rawPaths = Array.isArray(body.paths) ? body.paths : [];
    const normalizedPaths = rawPaths.map(path => normalizePath(path, { decode: false }));
    if (normalizedPaths.some(path => !path)) {
        return error('Invalid file path in request', 400);
    }
    const uniquePaths = [...new Set(normalizedPaths)];

    if (uniquePaths.length === 0) {
        return success({ repoId, files: [] });
    }

    if (uniquePaths.length > BATCH_FETCH_MAX_FILES) {
        return error(`A maximum of ${BATCH_FETCH_MAX_FILES} files can be fetched per request`, 400);
    }

    const files = (await Promise.all(
        uniquePaths.map(async (path) => {
            const content = await getFileContent(repoId, path);
            if (content === null) return null;
            return { path, content };
        }),
    )).filter(Boolean);

    return success({ repoId, files });
}

function normalizePath(path, options = { decode: false }) {
    if (typeof path !== 'string' || path.trim().length === 0) return null;

    let normalized = path;
    if (options.decode) {
        try {
            normalized = decodeURIComponent(path);
        } catch {
            return null;
        }
    }

    normalized = normalized.trim().replace(/^\/+/, '').replace(/\\/g, '/');
    if (!normalized || normalized.includes('\0')) return null;

    const parts = normalized.split('/').filter(Boolean);
    if (parts.some(part => part === '.' || part === '..')) return null;

    return parts.join('/');
}

async function getFileContent(repoId, filePath) {
    const key = `${repoId}:${filePath}`;
    if (fileContentCache.has(key)) {
        const cached = fileContentCache.get(key);
        fileContentCache.delete(key);
        fileContentCache.set(key, cached);
        return cached;
    }

    const content = await getText(`repos/${repoId}/files/${filePath}`);
    if (content !== null) {
        setCachedFileContent(key, content);
    }
    return content;
}

function setCachedFileContent(key, content) {
    if (fileContentCache.has(key)) {
        fileContentCache.delete(key);
    }
    fileContentCache.set(key, content);

    if (fileContentCache.size > FILE_CACHE_MAX_ENTRIES) {
        const oldestKey = fileContentCache.keys().next().value;
        if (oldestKey) {
            fileContentCache.delete(oldestKey);
        }
    }
}
