/**
 * GET /storyboards/{id} — Get full storyboard with all blocks.
 */
import { queryItems } from '../lib/dynamo.js';
import { success, error } from '../shared/response.js';

const STORYBOARDS_TABLE = process.env.STORYBOARDS_TABLE;

export const handler = async (event) => {
    try {
        const storyboardId = event.pathParameters?.id;
        if (!storyboardId) return error('Missing storyboard id', 400);

        const blocks = await queryItems(
            STORYBOARDS_TABLE,
            'storyboardId = :sid',
            { ':sid': storyboardId }
        );

        if (blocks.length === 0) {
            return error('Storyboard not found', 404);
        }

        // Sort by order
        blocks.sort((a, b) => (a.order || 0) - (b.order || 0));

        return success({
            storyboardId,
            repoId: blocks[0].repoId,
            blockCount: blocks.length,
            blocks,
        });

    } catch (err) {
        console.error('GetStoryboard error:', err);
        return error(err.message, 500);
    }
};
