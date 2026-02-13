/** Shared TypeScript types for Forge frontend */

// ---- Repository ----
export interface Repo {
    repoId: string;
    name: string;
    gitUrl: string;
    status: 'CLONING' | 'UPLOADED' | 'PARSING' | 'PARSED' | 'ERROR';
    commitSha?: string;
    fileCount?: number;
    moduleCount?: number;
    edgeCount?: number;
    groupCount?: number;
    storyboardId?: string;
    storyboardBlockCount?: number;
    errorMessage?: string;
    createdAt: string;
}

// ---- File Tree ----
export interface FileNode {
    name: string;
    type: 'file' | 'directory';
    path?: string;
    children?: FileNode[];
}

// ---- Storyboard ----
export interface StoryboardBlock {
    storyboardId: string;
    blockId: string;
    repoId: string;
    title: string;
    roleTags: string[];
    objective: string;
    explanationMarkdown: string;
    prerequisites: string[];
    next: string[];
    keyFiles: string[];
    keySymbols: string[];
    dependencySummary: string;
    diagramRefs: string[];
    mermaidDiagram?: string;
    resources: string[];
    keyTakeaways?: string[];
    suggestedQuestions?: string[];
    order: number;
    estimatedMinutes: number;
    generatedAt: string;
}

export interface Storyboard {
    storyboardId: string;
    repoId: string;
    blockCount: number;
    blocks: StoryboardBlock[];
}

// ---- Chat ----
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
}

// ---- Progress ----
export interface UserProgress {
    userId: string;
    repoId: string;
    role: string;
    completedBlocks: string[];
    timeOnBlockSeconds: Record<string, number>;
    lastActiveAt: string;
}

// ---- Roles ----
export type Role = 'frontend' | 'backend' | 'infra' | 'fullstack';

export const ROLES: { value: Role; label: string; color: string }[] = [
    { value: 'fullstack', label: 'Full Stack', color: 'var(--role-fullstack)' },
    { value: 'frontend', label: 'Frontend', color: 'var(--role-frontend)' },
    { value: 'backend', label: 'Backend', color: 'var(--role-backend)' },
    { value: 'infra', label: 'Infra', color: 'var(--role-infra)' },
];
