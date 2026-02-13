/**
 * GET /repos/{id} — Get repo status and metadata.
 */
import { getItem } from '../lib/dynamo.js';
import { success, error } from '../shared/response.js';

const REPOS_TABLE = process.env.REPOS_TABLE;

export const handler = async (event) => {
    try {
        const repoId = event.pathParameters?.id;
        if (!repoId) return error('Missing repo id', 400);

        const repo = await getItem(REPOS_TABLE, { repoId });
        if (!repo) return error('Repo not found', 404);

        return success(repo);
    } catch (err) {
        console.error('GetRepo error:', err);
        return error(err.message, 500);
    }
};
