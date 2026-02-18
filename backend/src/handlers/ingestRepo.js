/**
 * POST /repos — Ingest a repository from a Git URL.
 * Clones the repo using isomorphic-git, stores files in S3.
 */
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'node:fs';
import path from 'node:path';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { v4 as uuid } from 'uuid';
import { getItem, putItem, scanItems, updateItem } from '../lib/dynamo.js';
import { uploadText, uploadJson } from '../lib/s3.js';
import { success, error, parseBody } from '../shared/response.js';

const REPOS_TABLE = process.env.REPOS_TABLE;
const TMP_ROOT = '/tmp/forge-repos';
const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_TIMEOUT_MS = 4500;
const INGEST_ASYNC_EVENT_SOURCE = 'forge.repo.ingest';

const lambdaClient = new LambdaClient({});

export const handler = async (event) => {
    if (isAsyncIngestInvocation(event)) {
        return await handleAsyncIngestInvocation(event);
    }

    return await handleIngestHttpRequest(event);
};

function isAsyncIngestInvocation(event) {
    return event?.source === INGEST_ASYNC_EVENT_SOURCE;
}

async function handleIngestHttpRequest(event) {
    try {
        const body = parseBody(event);
        const { gitUrl, name } = body;

        if (!gitUrl) {
            return error('gitUrl is required', 400);
        }

        const normalizedGitUrl = normalizeGitUrl(gitUrl);
        const githubRepo = extractGithubRepo(normalizedGitUrl);
        const githubHead = githubRepo
            ? await fetchGithubHeadInfo(githubRepo.owner, githubRepo.repo)
            : null;

        // Reuse an existing parsed build for exact same public GitHub HEAD commit.
        if (githubHead?.isPublic && githubHead.headSha) {
            const reusable = await findReusableRepo(normalizedGitUrl, githubHead.headSha);
            if (reusable) {
                return success({
                    repoId: reusable.repoId,
                    name: reusable.name,
                    status: reusable.status,
                    fileCount: reusable.fileCount || 0,
                    commitSha: reusable.commitSha || githubHead.headSha,
                    storyboardId: reusable.storyboardId || null,
                    cached: true,
                    reused: true,
                    reusedFromRepoId: reusable.repoId,
                });
            }
        }

        const repoId = uuid();
        const repoName = name || gitUrl.split('/').pop()?.replace('.git', '') || repoId;

        // Create repo record
        await putItem(REPOS_TABLE, {
            repoId,
            name: repoName,
            gitUrl,
            gitUrlCanonical: normalizedGitUrl,
            status: 'CLONING',
            isPublicRepo: githubHead?.isPublic === true,
            createdAt: new Date().toISOString(),
        });

        try {
            await enqueueIngest({
                repoId,
                repoName,
                gitUrl,
                gitUrlCanonical: normalizedGitUrl,
                isPublicRepo: githubHead?.isPublic === true,
            });
        } catch (err) {
            await markIngestFailure(repoId, err);
            throw err;
        }

        return success({
            repoId,
            name: repoName,
            status: 'CLONING',
            fileCount: 0,
            commitSha: null,
            storyboardId: null,
            cached: false,
            inProgress: true,
            queued: true,
        }, 202);
    } catch (err) {
        console.error('IngestRepo enqueue error:', err);
        return error(`Failed to ingest repository: ${err.message}`, 500);
    }
}

async function handleAsyncIngestInvocation(event) {
    const repoId = typeof event?.repoId === 'string' ? event.repoId : '';
    const repoName = typeof event?.repoName === 'string' ? event.repoName : '';
    const gitUrl = typeof event?.gitUrl === 'string' ? event.gitUrl : '';
    const gitUrlCanonical = typeof event?.gitUrlCanonical === 'string' ? event.gitUrlCanonical : normalizeGitUrl(gitUrl);

    if (!repoId || !repoName || !gitUrl) {
        console.error('IngestRepo async invocation missing required fields');
        return { ok: false, reason: 'missing_fields' };
    }

    try {
        const repo = await getItem(REPOS_TABLE, { repoId });
        if (!repo) {
            throw new Error(`Repo not found for async ingest: ${repoId}`);
        }

        if (repo.status === 'UPLOADED' || repo.status === 'PARSED') {
            return {
                ok: true,
                repoId,
                status: repo.status,
                cached: true,
                commitSha: repo.commitSha || null,
                fileCount: repo.fileCount || 0,
            };
        }

        if (repo.status !== 'CLONING') {
            await updateItem(REPOS_TABLE, { repoId }, {
                status: 'CLONING',
                errorMessage: null,
            });
        }

        const ingestResult = await ingestRepoContents({
            repoId,
            repoName,
            gitUrl,
            gitUrlCanonical,
        });

        await updateItem(REPOS_TABLE, { repoId }, {
            status: 'UPLOADED',
            commitSha: ingestResult.headSha,
            fileCount: ingestResult.fileCount,
            commitHistory: JSON.stringify(ingestResult.commitHistory),
            gitUrlCanonical,
            errorMessage: null,
        });

        return {
            ok: true,
            repoId,
            status: 'UPLOADED',
            commitSha: ingestResult.headSha,
            fileCount: ingestResult.fileCount,
        };
    } catch (err) {
        console.error('IngestRepo async worker error:', err);
        await markIngestFailure(repoId, err);
        return { ok: false, repoId, error: err.message };
    }
}

async function enqueueIngest(payload) {
    const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
    if (!functionName) {
        throw new Error('Missing AWS_LAMBDA_FUNCTION_NAME; cannot enqueue ingest');
    }

    await lambdaClient.send(new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'Event',
        Payload: Buffer.from(JSON.stringify({
            source: INGEST_ASYNC_EVENT_SOURCE,
            ...payload,
        })),
    }));
}

async function markIngestFailure(repoId, err) {
    if (!repoId) return;

    try {
        await updateItem(REPOS_TABLE, { repoId }, {
            status: 'ERROR',
            errorMessage: err?.message || 'Ingest failed',
        });
    } catch (updateErr) {
        console.error('Failed to persist ingest failure state:', updateErr);
    }
}

async function ingestRepoContents({ repoId, repoName, gitUrl, gitUrlCanonical }) {
    const dir = path.join(TMP_ROOT, repoId);
    await fs.promises.mkdir(dir, { recursive: true });

    try {
        await git.clone({
            fs,
            http,
            dir,
            url: gitUrl,
            singleBranch: true,
            depth: 50,
        });

        const commits = await git.log({ fs, dir, depth: 20 });
        const commitHistory = commits.map(c => ({
            sha: c.oid.substring(0, 7),
            message: c.commit.message.trim(),
            author: c.commit.author.name,
            date: new Date(c.commit.author.timestamp * 1000).toISOString(),
        }));

        const headSha = commits[0]?.oid || 'unknown';

        const files = [];
        await walkTree(dir, '', files);

        const fileList = files.map(f => f.path);
        const batchSize = 25;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            await Promise.all(
                batch.map(file => {
                    const s3Key = `repos/${repoId}/files/${file.path}`;
                    return uploadText(s3Key, file.content);
                }),
            );
        }

        await uploadJson(`repos/${repoId}/metadata.json`, {
            repoId,
            name: repoName,
            gitUrl,
            gitUrlCanonical,
            headSha,
            commitHistory,
            fileList,
            fileCount: files.length,
        });

        return {
            headSha,
            commitHistory,
            fileCount: files.length,
        };
    } finally {
        await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => { });
    }
}

async function findReusableRepo(gitUrlCanonical, headSha) {
    const repos = await scanItems(REPOS_TABLE);
    if (!Array.isArray(repos) || repos.length === 0) return null;

    const candidates = repos
        .filter((repo) => {
            if (!repo || repo.status !== 'PARSED') return false;
            if (!repo.commitSha || repo.commitSha !== headSha) return false;
            const candidateUrl = normalizeGitUrl(repo.gitUrlCanonical || repo.gitUrl || '');
            return Boolean(candidateUrl) && candidateUrl === gitUrlCanonical;
        })
        .sort((a, b) => {
            const aHasStoryboard = a.storyboardId ? 1 : 0;
            const bHasStoryboard = b.storyboardId ? 1 : 0;
            if (aHasStoryboard !== bHasStoryboard) return bHasStoryboard - aHasStoryboard;
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

    return candidates[0] || null;
}

function normalizeGitUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return '';

    let value = rawUrl.trim();
    if (!value) return '';

    value = value
        .replace(/^git@github\.com:/i, 'https://github.com/')
        .replace(/^ssh:\/\/git@github\.com\//i, 'https://github.com/');

    if (/^github\.com\//i.test(value)) {
        value = `https://${value}`;
    }

    try {
        const parsed = new URL(value);
        const host = parsed.hostname.toLowerCase();
        const cleanPath = parsed.pathname
            .replace(/^\/+/, '')
            .replace(/\/+$/, '')
            .replace(/\.git$/i, '');

        const [owner, repo] = cleanPath.split('/');
        if (host === 'github.com' && owner && repo) {
            return `https://github.com/${owner.toLowerCase()}/${repo.toLowerCase()}`;
        }

        return `${parsed.protocol}//${host}/${cleanPath}`;
    } catch {
        return value.toLowerCase().replace(/\/+$/, '').replace(/\.git$/i, '');
    }
}

function extractGithubRepo(normalizedGitUrl) {
    try {
        const parsed = new URL(normalizedGitUrl);
        if (parsed.hostname !== 'github.com') return null;
        const [owner, repo] = parsed.pathname.replace(/^\/+/, '').split('/');
        if (!owner || !repo) return null;
        return { owner, repo };
    } catch {
        return null;
    }
}

async function fetchGithubHeadInfo(owner, repo) {
    const repoMeta = await githubApiJson(`/repos/${owner}/${repo}`);
    if (!repoMeta || repoMeta.private !== false || !repoMeta.default_branch) {
        return null;
    }

    const commitMeta = await githubApiJson(`/repos/${owner}/${repo}/commits/${encodeURIComponent(repoMeta.default_branch)}`);
    const headSha = typeof commitMeta?.sha === 'string' ? commitMeta.sha : null;
    if (!headSha) return null;

    return {
        isPublic: true,
        headSha,
        defaultBranch: repoMeta.default_branch,
    };
}

async function githubApiJson(pathname) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);

    try {
        const response = await fetch(`${GITHUB_API_BASE}${pathname}`, {
            method: 'GET',
            headers: {
                Accept: 'application/vnd.github+json',
                'User-Agent': 'forge-app',
            },
            signal: controller.signal,
        });

        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

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
