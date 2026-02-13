/**
 * GET /repos/{id}/files — List file tree from S3
 * GET /repos/{id}/files/{path+} — Get single file content
 */
import { listObjects, getText } from '../lib/s3.js';
import { getItem } from '../lib/dynamo.js';
import { success, error } from '../shared/response.js';

const REPOS_TABLE = process.env.REPOS_TABLE;

export const handler = async (event) => {
    try {
        const repoId = event.pathParameters?.id;
        if (!repoId) return error('Missing repo id', 400);

        // Check repo exists
        const repo = await getItem(REPOS_TABLE, { repoId });
        if (!repo) return error('Repo not found', 404);

        const filePath = event.pathParameters?.path;

        if (filePath) {
            // GET single file content
            const content = await getText(`repos/${repoId}/files/${filePath}`);
            if (content === null) return error('File not found', 404);

            return success({ path: filePath, content });
        }

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
