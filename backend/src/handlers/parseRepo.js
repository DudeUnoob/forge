/**
 * POST /repos/{id}/parse — Parse repository files into AST + module graph.
 */
import { getItem, updateItem } from '../lib/dynamo.js';
import { getJson, listObjects, getText, uploadJson } from '../lib/s3.js';
import { parseFiles } from '../lib/parser.js';
import { success, error } from '../shared/response.js';

const REPOS_TABLE = process.env.REPOS_TABLE;
const FILE_DOWNLOAD_BATCH_SIZE = 30;
const MODULE_UPLOAD_BATCH_SIZE = 40;

export const handler = async (event) => {
    try {
        const repoId = event.pathParameters?.id;
        if (!repoId) return error('Missing repo id', 400);

        // Check repo exists
        const repo = await getItem(REPOS_TABLE, { repoId });
        if (!repo) return error('Repo not found', 404);

        if (repo.status === 'PARSING') {
            return success({
                repoId,
                status: 'PARSING',
                inProgress: true,
            }, 202);
        }

        // Check for cached parse (same SHA)
        if (repo.status === 'PARSED' && repo.commitSha) {
            const cached = await getJson(`repos/${repoId}/parsed/module-graph.json`);
            if (cached) {
                return success({ repoId, status: 'PARSED', cached: true, ...cached.stats });
            }
        }

        // Update status to PARSING
        await updateItem(REPOS_TABLE, { repoId }, { status: 'PARSING' });

        // List all files from S3
        const fileObjects = await listObjects(`repos/${repoId}/files/`);

        // Download file contents
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

        // Parse files
        const moduleGraph = parseFiles(files);

        // Store parsed results
        await uploadJson(`repos/${repoId}/parsed/module-graph.json`, moduleGraph);

        // Store individual module details for quick lookup
        for (let i = 0; i < moduleGraph.modules.length; i += MODULE_UPLOAD_BATCH_SIZE) {
            const batch = moduleGraph.modules.slice(i, i + MODULE_UPLOAD_BATCH_SIZE);
            await Promise.all(
                batch.map((mod) => {
                    const safeKey = mod.path.replace(/\//g, '__');
                    return uploadJson(`repos/${repoId}/parsed/modules/${safeKey}.json`, mod);
                }),
            );
        }

        // Update repo status
        await updateItem(REPOS_TABLE, { repoId }, {
            status: 'PARSED',
            moduleCount: moduleGraph.stats.totalModules,
            edgeCount: moduleGraph.stats.totalEdges,
            groupCount: moduleGraph.stats.totalGroups,
            parsedAt: new Date().toISOString(),
        });

        return success({
            repoId,
            status: 'PARSED',
            ...moduleGraph.stats,
        });

    } catch (err) {
        console.error('ParseRepo error:', err);

        // Try to update status to ERROR
        try {
            const repoId = event.pathParameters?.id;
            if (repoId) {
                await updateItem(REPOS_TABLE, { repoId }, {
                    status: 'ERROR',
                    errorMessage: err.message,
                });
            }
        } catch { }

        return error(`Parse failed: ${err.message}`, 500);
    }
};
