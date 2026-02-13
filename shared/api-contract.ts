/**
 * Shared API contract definitions between frontend and backend.
 * This file documents all REST endpoints, request/response shapes.
 */

// ================= API ENDPOINTS =================

export const API_ROUTES = {
    // Repository Ingestion
    INGEST_REPO: 'POST   /repos',
    GET_REPO: 'GET    /repos/{id}',
    PARSE_REPO: 'POST   /repos/{id}/parse',
    LIST_FILES: 'GET    /repos/{id}/files',
    GET_FILE: 'GET    /repos/{id}/files/{path+}',

    // Storyboard
    GENERATE_STORYBOARD: 'POST   /repos/{id}/storyboard',
    GET_STORYBOARD: 'GET    /storyboards/{id}',

    // Chat
    BLOCK_CHAT: 'POST   /storyboards/{id}/blocks/{blockId}/chat',

    // Progress
    GET_PROGRESS: 'GET    /progress/{userId}',
    UPDATE_PROGRESS: 'POST   /progress/{userId}',
} as const;

// ================= REQUEST BODIES =================

export interface IngestRepoRequest {
    gitUrl: string;
    name?: string;
}

export interface GenerateStoryboardRequest {
    role?: 'frontend' | 'backend' | 'infra' | 'fullstack';
}

export interface ChatRequest {
    message: string;
    userId?: string;
}

export interface UpdateProgressRequest {
    repoId: string;
    blockId?: string;
    action: 'complete_block' | 'uncomplete_block' | 'track_time' | 'set_role';
    timeSpentSeconds?: number;
    role?: string;
}

// ================= RESPONSE BODIES =================

export interface IngestRepoResponse {
    repoId: string;
    name: string;
    status: string;
    fileCount: number;
    commitSha: string;
}

export interface ParseRepoResponse {
    repoId: string;
    status: string;
    totalFiles: number;
    parsedFiles: number;
    totalModules: number;
    totalEdges: number;
}

export interface GenerateStoryboardResponse {
    storyboardId: string;
    repoId: string;
    blockCount: number;
    blocks: Array<{
        blockId: string;
        title: string;
        objective: string;
        order: number;
        roleTags: string[];
    }>;
}

export interface ChatResponse {
    blockId: string;
    response: string;
    messageCount: number;
}
