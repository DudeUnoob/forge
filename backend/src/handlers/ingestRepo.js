/**
 * POST /repos — Ingest a repository from a Git URL.
 * Clones the repo using isomorphic-git, stores files in S3.
 */
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'node:fs';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { putItem, updateItem } from '../lib/dynamo.js';
import { uploadText, uploadJson } from '../lib/s3.js';
import { success, error, parseBody } from '../shared/response.js';

const REPOS_TABLE = process.env.REPOS_TABLE;
const TMP_ROOT = '/tmp/forge-repos';

export const handler = async (event) => {
    try {
        const body = parseBody(event);
        const { gitUrl, name } = body;

        if (!gitUrl) {
            return error('gitUrl is required', 400);
        }

        const repoId = uuid();
        const repoName = name || gitUrl.split('/').pop()?.replace('.git', '') || repoId;

        // Create repo record
        await putItem(REPOS_TABLE, {
            repoId,
            name: repoName,
            gitUrl,
            status: 'CLONING',
            createdAt: new Date().toISOString(),
        });

        const dir = path.join(TMP_ROOT, repoId);
        await fs.promises.mkdir(dir, { recursive: true });

        try {
            await git.clone({
                fs,
                http,
                dir,
                url: gitUrl,
                singleBranch: true,
                depth: 50, // Get last 50 commits for history
            });

            // Get commit history
            const commits = await git.log({ fs, dir, depth: 20 });
            const commitHistory = commits.map(c => ({
                sha: c.oid.substring(0, 7),
                message: c.commit.message.trim(),
                author: c.commit.author.name,
                date: new Date(c.commit.author.timestamp * 1000).toISOString(),
            }));

            // Get the HEAD SHA
            const headSha = commits[0]?.oid || 'unknown';

            // Walk the tree and collect all files
            const files = [];
            await walkTree(dir, '', files);

            // Upload files to S3
            const fileList = [];
            for (const file of files) {
                const s3Key = `repos/${repoId}/files/${file.path}`;
                await uploadText(s3Key, file.content);
                fileList.push(file.path);
            }

            // Store metadata
            await uploadJson(`repos/${repoId}/metadata.json`, {
                repoId,
                name: repoName,
                gitUrl,
                headSha,
                commitHistory,
                fileList,
                fileCount: files.length,
            });

            // Update repo status
            await updateItem(REPOS_TABLE, { repoId }, {
                status: 'UPLOADED',
                commitSha: headSha,
                fileCount: files.length,
                commitHistory: JSON.stringify(commitHistory),
            });

            return success({
                repoId,
                name: repoName,
                status: 'UPLOADED',
                fileCount: files.length,
                commitSha: headSha,
            }, 201);
        } finally {
            await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => { });
        }

    } catch (err) {
        console.error('IngestRepo error:', err);
        return error(`Failed to ingest repository: ${err.message}`, 500);
    }
};

async function walkTree(baseDir, relativePath, results) {
    const fullPath = relativePath ? path.join(baseDir, relativePath) : baseDir;
    const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
        const entryName = entry.name;
        if (entryName.startsWith('.') && entryName !== '.env.example') continue;
        if (['node_modules', '__pycache__', '.git', 'dist', 'build', '.next'].includes(entryName)) continue;

        const entryRelative = relativePath ? `${relativePath}/${entryName}` : entryName;
        const entryFull = path.join(baseDir, entryRelative);

        try {
            if (entry.isDirectory()) {
                await walkTree(baseDir, entryRelative, results);
            } else if (entry.isFile()) {
                // Skip binary/large files
                const stat = await fs.promises.stat(entryFull);
                if (stat.size > 500000) continue; // Skip files > 500KB
                const ext = path.extname(entryName).toLowerCase();
                const textExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.json', '.md', '.yaml', '.yml',
                    '.html', '.css', '.scss', '.txt', '.env', '.toml', '.cfg', '.ini', '.sh',
                    '.sql', '.graphql', '.xml', '.svg', '.rb', '.go', '.rs', '.java', '.kt',
                    '.swift', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.lua', '.r',
                    '.dockerfile', '.gitignore', '.env.example', '.mjs', '.cjs'];
                if (!textExts.includes(ext) && !entryName.includes('Dockerfile') && !entryName.includes('Makefile')) continue;

                try {
                    const content = await fs.promises.readFile(entryFull, 'utf8');
                    results.push({
                        path: entryRelative.split(path.sep).join('/'),
                        content,
                    });
                } catch {
                    // Skip unreadable files
                }
            }
        } catch {
            // Skip stat failures
        }
    }
}
