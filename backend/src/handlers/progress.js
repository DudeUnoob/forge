/**
 * GET /progress/{userId} — Get user progress across repos.
 * POST /progress/{userId} — Update progress (complete block, track time).
 */
import { getItem, putItem, queryItems, updateItem } from '../lib/dynamo.js';
import { success, error, parseBody } from '../shared/response.js';

const PROGRESS_TABLE = process.env.PROGRESS_TABLE;

export const handler = async (event) => {
    try {
        const userId = event.pathParameters?.userId;
        if (!userId) return error('Missing userId', 400);

        const method = event.requestContext?.http?.method || event.httpMethod;

        if (method === 'GET') {
            return handleGet(userId);
        } else if (method === 'POST') {
            return handlePost(userId, parseBody(event));
        }

        return error('Method not allowed', 405);
    } catch (err) {
        console.error('Progress error:', err);
        return error(err.message, 500);
    }
};

async function handleGet(userId) {
    const items = await queryItems(
        PROGRESS_TABLE,
        'userId = :uid',
        { ':uid': userId }
    );

    return success({ userId, repos: items });
}

async function handlePost(userId, body) {
    const { repoId, blockId, action, timeSpentSeconds, role } = body;

    if (!repoId) return error('repoId is required', 400);

    // Get or create progress record
    let progress = await getItem(PROGRESS_TABLE, { userId, repoId });

    if (!progress) {
        progress = {
            userId,
            repoId,
            role: role || 'fullstack',
            completedBlocks: [],
            timeOnBlockSeconds: {},
            lastActiveAt: new Date().toISOString(),
        };
        await putItem(PROGRESS_TABLE, progress);
    }

    switch (action) {
        case 'complete_block': {
            if (!blockId) return error('blockId required for complete_block', 400);
            const completed = new Set(progress.completedBlocks || []);
            completed.add(blockId);
            await updateItem(PROGRESS_TABLE, { userId, repoId }, {
                completedBlocks: [...completed],
                lastActiveAt: new Date().toISOString(),
            });
            break;
        }

        case 'uncomplete_block': {
            if (!blockId) return error('blockId required for uncomplete_block', 400);
            const completed = new Set(progress.completedBlocks || []);
            completed.delete(blockId);
            await updateItem(PROGRESS_TABLE, { userId, repoId }, {
                completedBlocks: [...completed],
                lastActiveAt: new Date().toISOString(),
            });
            break;
        }

        case 'track_time': {
            if (!blockId || !timeSpentSeconds) return error('blockId and timeSpentSeconds required', 400);
            const timeMap = progress.timeOnBlockSeconds || {};
            timeMap[blockId] = (timeMap[blockId] || 0) + timeSpentSeconds;
            await updateItem(PROGRESS_TABLE, { userId, repoId }, {
                timeOnBlockSeconds: timeMap,
                lastActiveAt: new Date().toISOString(),
            });
            break;
        }

        case 'set_role': {
            if (!role) return error('role required for set_role', 400);
            await updateItem(PROGRESS_TABLE, { userId, repoId }, {
                role,
                lastActiveAt: new Date().toISOString(),
            });
            break;
        }

        default:
            return error('Invalid action. Use: complete_block, uncomplete_block, track_time, set_role', 400);
    }

    // Return updated progress
    const updated = await getItem(PROGRESS_TABLE, { userId, repoId });
    return success(updated);
}
