/** Forge API client — communicates with API Gateway backend */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${path}`;
    console.log(`[Forge API] ${options.method || 'GET'} ${url}`);

    let res: Response;
    try {
        res = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });
    } catch (networkErr) {
        console.error(`[Forge API] Network error for ${url}:`, networkErr);
        throw new Error(`Cannot reach backend at ${API_BASE}. Is it running?`);
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        const msg = body.error || `${res.status} ${res.statusText}`;
        console.error(`[Forge API] Error ${res.status} for ${url}:`, msg);
        throw new Error(msg);
    }

    return res.json();
}

// ---- Repos ----
export const api = {
    repos: {
        ingest: (gitUrl: string, name?: string) =>
            request<{ repoId: string; status: string; fileCount: number }>('/repos', {
                method: 'POST',
                body: JSON.stringify({ gitUrl, name }),
            }),

        get: (repoId: string) =>
            request<import('./types').Repo>(`/repos/${repoId}`),

        parse: (repoId: string) =>
            request<{ repoId: string; status: string }>(`/repos/${repoId}/parse`, {
                method: 'POST',
            }),

        files: (repoId: string) =>
            request<{ repoId: string; tree: import('./types').FileNode }>(`/repos/${repoId}/files`),

        fileContent: (repoId: string, path: string) =>
            request<{ path: string; content: string }>(`/repos/${repoId}/files/${path}`),
    },

    storyboard: {
        generate: (repoId: string, role?: string) =>
            request<{ storyboardId: string; blockCount: number }>(`/repos/${repoId}/storyboard`, {
                method: 'POST',
                body: JSON.stringify({ role }),
            }),

        get: (storyboardId: string) =>
            request<import('./types').Storyboard>(`/storyboards/${storyboardId}`),
    },

    chat: {
        send: (storyboardId: string, blockId: string, message: string, userId?: string) =>
            request<{ blockId: string; response: string }>(`/storyboards/${storyboardId}/blocks/${blockId}/chat`, {
                method: 'POST',
                body: JSON.stringify({ message, userId: userId || 'anonymous' }),
            }),
    },

    progress: {
        get: (userId: string) =>
            request<{ userId: string; repos: import('./types').UserProgress[] }>(`/progress/${userId}`),

        completeBlock: (userId: string, repoId: string, blockId: string) =>
            request<import('./types').UserProgress>(`/progress/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ repoId, blockId, action: 'complete_block' }),
            }),

        trackTime: (userId: string, repoId: string, blockId: string, timeSpentSeconds: number) =>
            request<import('./types').UserProgress>(`/progress/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ repoId, blockId, action: 'track_time', timeSpentSeconds }),
            }),

        setRole: (userId: string, repoId: string, role: string) =>
            request<import('./types').UserProgress>(`/progress/${userId}`, {
                method: 'POST',
                body: JSON.stringify({ repoId, action: 'set_role', role }),
            }),
    },
};
