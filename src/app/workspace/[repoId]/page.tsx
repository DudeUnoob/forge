'use client';

import { useState, useEffect, useCallback, useId, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Repo, FileNode, Storyboard, StoryboardBlock, ChatMessage, Role } from '@/lib/types';
import { ROLES } from '@/lib/types';
import '../../workspace.css';

interface SetiIconDefinition {
    fontCharacter?: string;
    fontColor?: string;
}

interface SetiIconTheme {
    file?: string;
    folder?: string;
    folderExpanded?: string;
    rootFolder?: string;
    rootFolderExpanded?: string;
    fileExtensions?: Record<string, string>;
    fileNames?: Record<string, string>;
    folderNames?: Record<string, string>;
    folderNamesExpanded?: Record<string, string>;
    iconDefinitions?: Record<string, SetiIconDefinition>;
}

interface VscodeLikeIcon {
    type: 'badge' | 'codicon';
    label?: string;
    codicon?: string;
    color?: string;
    background?: string;
    dotColor?: string;
}

interface MermaidRenderResult {
    svg: string;
}

interface MermaidApi {
    initialize: (config: Record<string, unknown>) => void;
    render: (id: string, diagram: string) => Promise<MermaidRenderResult>;
}

declare global {
    interface Window {
        mermaid?: MermaidApi;
        __forgeMermaidLoader?: Promise<MermaidApi>;
        __forgeMermaidInitialized?: boolean;
    }
}

const SETI_THEME_URL = 'https://cdn.jsdelivr.net/gh/microsoft/vscode@main/extensions/theme-seti/icons/vs-seti-icon-theme.json';
const MERMAID_CDN_URL = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
const FILE_CONTENT_CACHE_LIMIT = 80;
const PREFETCH_BATCH_SIZE = 20;
const PREFETCH_TREE_SAMPLE_SIZE = 16;
const PREFETCH_BLOCK_SAMPLE_SIZE = 12;
const REPO_POLL_INTERVAL_MS = 2500;

// =============== Main Workspace Component ===============

export default function WorkspacePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const repoId = params.repoId as string;
    const initialStoryboardId = searchParams.get('storyboard');

    // Core state
    const [repo, setRepo] = useState<Repo | null>(null);
    const [fileTree, setFileTree] = useState<FileNode | null>(null);
    const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
    const [activeStoryboardId, setActiveStoryboardId] = useState<string | null>(initialStoryboardId);
    const [activeBlock, setActiveBlock] = useState<StoryboardBlock | null>(null);
    const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set());

    // Editor state
    const [openFiles, setOpenFiles] = useState<{ path: string; content: string }[]>([]);
    const [activeFileIndex, setActiveFileIndex] = useState<number>(-1);
    const [highlightedLines, setHighlightedLines] = useState<Set<number>>(new Set());

    // Panel state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [role, setRole] = useState<Role>('fullstack');

    // UI state
    const [loading, setLoading] = useState(true);
    const [errors, setErrors] = useState<string[]>([]);
    const [sidebarView, setSidebarView] = useState<'explorer' | 'search' | 'storyboard'>('explorer');
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [treeFilter, setTreeFilter] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [setiTheme, setSetiTheme] = useState<SetiIconTheme | null>(null);
    const [pipelineMessage, setPipelineMessage] = useState<string | null>(null);
    const [pipelineBusy, setPipelineBusy] = useState(false);
    const fileContentCacheRef = useRef<Map<string, string>>(new Map());
    const inFlightFileRequestsRef = useRef<Map<string, Promise<string>>>(new Map());
    const prefetchedPathsRef = useRef<Set<string>>(new Set());
    const parseTriggeredRef = useRef(false);
    const storyboardTriggeredRef = useRef(false);

    useEffect(() => {
        let isMounted = true;

        fetch(SETI_THEME_URL)
            .then(res => res.json())
            .then((theme: SetiIconTheme) => {
                if (isMounted) setSetiTheme(theme);
            })
            .catch(() => {
                if (isMounted) setSetiTheme(null);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // ---- Add keyboard shortcuts ----
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + K for command palette
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowCommandPalette(v => !v);
            }
            // Cmd/Ctrl + B to toggle sidebar
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
                e.preventDefault();
                setSidebarCollapsed(v => !v);
            }
            // Escape to close command palette
            if (e.key === 'Escape') {
                setShowCommandPalette(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Reset caches when switching repositories
    useEffect(() => {
        fileContentCacheRef.current.clear();
        inFlightFileRequestsRef.current.clear();
        prefetchedPathsRef.current.clear();
        parseTriggeredRef.current = false;
        storyboardTriggeredRef.current = false;
        setActiveStoryboardId(initialStoryboardId);
        setPipelineBusy(false);
        setPipelineMessage(null);
        setStoryboard(null);
        setActiveBlock(null);
        setCompletedBlocks(new Set());
    }, [repoId, initialStoryboardId]);

    const cacheFileContent = useCallback((path: string, content: string) => {
        const cache = fileContentCacheRef.current;
        if (cache.has(path)) {
            cache.delete(path);
        }
        cache.set(path, content);

        while (cache.size > FILE_CONTENT_CACHE_LIMIT) {
            const oldest = cache.keys().next().value;
            if (!oldest) break;
            cache.delete(oldest);
        }
    }, []);

    const fetchFileContent = useCallback(async (path: string): Promise<string> => {
        const cache = fileContentCacheRef.current;
        if (cache.has(path)) {
            const cached = cache.get(path) as string;
            cache.delete(path);
            cache.set(path, cached);
            return cached;
        }

        const pending = inFlightFileRequestsRef.current.get(path);
        if (pending) return pending;

        const request = api.repos.fileContent(repoId, path)
            .then(({ content }) => {
                cacheFileContent(path, content);
                return content;
            })
            .finally(() => {
                inFlightFileRequestsRef.current.delete(path);
            });

        inFlightFileRequestsRef.current.set(path, request);
        return request;
    }, [cacheFileContent, repoId]);

    const prefetchFiles = useCallback(async (paths: string[]) => {
        const uniqueCandidates = [...new Set(
            paths
                .map(path => path?.trim())
                .filter((path): path is string => Boolean(path)),
        )];

        const pathsToPrefetch = uniqueCandidates
            .filter((path) => {
                if (fileContentCacheRef.current.has(path)) return false;
                if (inFlightFileRequestsRef.current.has(path)) return false;
                if (prefetchedPathsRef.current.has(path)) return false;
                return true;
            })
            .slice(0, PREFETCH_BATCH_SIZE);

        if (pathsToPrefetch.length === 0) return;
        pathsToPrefetch.forEach(path => prefetchedPathsRef.current.add(path));

        try {
            const { files } = await api.repos.fileContents(repoId, pathsToPrefetch);
            const fetched = new Set<string>();

            for (const file of files) {
                cacheFileContent(file.path, file.content);
                fetched.add(file.path);
            }

            for (const path of pathsToPrefetch) {
                if (!fetched.has(path)) {
                    prefetchedPathsRef.current.delete(path);
                }
            }
        } catch {
            for (const path of pathsToPrefetch) {
                prefetchedPathsRef.current.delete(path);
            }

            // Fallback for environments where batch endpoint is not deployed yet.
            await Promise.allSettled(
                pathsToPrefetch.slice(0, 4).map(path => fetchFileContent(path)),
            );
        }
    }, [cacheFileContent, fetchFileContent, repoId]);

    const prefetchFile = useCallback((path: string) => {
        void prefetchFiles([path]);
    }, [prefetchFiles]);

    const refreshRepo = useCallback(async () => {
        const repoData = await api.repos.get(repoId);
        setRepo(repoData);
        if (repoData.storyboardId && repoData.storyboardId !== activeStoryboardId) {
            setActiveStoryboardId(repoData.storyboardId);
        }
        return repoData;
    }, [activeStoryboardId, repoId]);

    // ---- Fetch base data on mount ----
    useEffect(() => {
        let isMounted = true;

        async function load() {
            setLoading(true);
            const loadErrors: string[] = [];

            const [repoResult, filesResult] = await Promise.allSettled([
                api.repos.get(repoId),
                api.repos.files(repoId),
            ]);

            if (!isMounted) return;

            if (repoResult.status === 'fulfilled') {
                setRepo(repoResult.value);
                if (repoResult.value.storyboardId) {
                    setActiveStoryboardId(repoResult.value.storyboardId);
                }
            } else {
                const msg = repoResult.reason instanceof Error ? repoResult.reason.message : 'Failed to load repo';
                loadErrors.push(`Repo: ${msg}`);
                console.error('Repo load error:', repoResult.reason);
            }

            if (filesResult.status === 'fulfilled') {
                setFileTree(filesResult.value.tree);
            } else {
                const msg = filesResult.reason instanceof Error ? filesResult.reason.message : 'Failed to load files';
                loadErrors.push(`Files: ${msg}`);
                console.error('Files load error:', filesResult.reason);
            }

            if (loadErrors.length > 0) setErrors(loadErrors);
            setLoading(false);
        }

        void load();
        return () => {
            isMounted = false;
        };
    }, [repoId]);

    // ---- Fetch storyboard whenever an id is available ----
    useEffect(() => {
        if (!activeStoryboardId) {
            setStoryboard(null);
            return;
        }

        let isMounted = true;
        api.storyboard.get(activeStoryboardId)
            .then((sb) => {
                if (!isMounted) return;
                setStoryboard(sb);
                setPipelineBusy(false);
                setPipelineMessage(null);
            })
            .catch((err) => {
                if (!isMounted) return;
                const msg = err instanceof Error ? err.message : 'Failed to load storyboard';
                setErrors(prev => [...prev, `Storyboard: ${msg}`]);
                console.error('Storyboard load error:', err);
            });

        return () => {
            isMounted = false;
        };
    }, [activeStoryboardId]);

    // ---- Poll repo status until storyboard is ready ----
    useEffect(() => {
        if (!repoId) return;

        const shouldPoll = !repo?.storyboardId
            || repo.status === 'PARSING'
            || repo.status === 'GENERATING_STORYBOARD'
            || repo.status === 'UPLOADED'
            || repo.status === 'CLONING';

        if (!shouldPoll) return;

        const timer = window.setInterval(() => {
            void refreshRepo().catch((err) => {
                console.error('Repo poll error:', err);
            });
        }, REPO_POLL_INTERVAL_MS);

        return () => {
            window.clearInterval(timer);
        };
    }, [refreshRepo, repo?.status, repo?.storyboardId, repoId]);

    // ---- Orchestrate parse + storyboard stages in the background ----
    useEffect(() => {
        if (!repo) return;

        if (repo.storyboardId) {
            setPipelineBusy(false);
            setPipelineMessage(null);
            if (repo.storyboardId !== activeStoryboardId) {
                setActiveStoryboardId(repo.storyboardId);
            }
            return;
        }

        if (repo.status === 'CLONING') {
            setPipelineBusy(true);
            setPipelineMessage('Cloning repository snapshot...');
            return;
        }

        if (repo.status === 'UPLOADED') {
            setPipelineBusy(true);
            setPipelineMessage('Parsing modules and dependency graph...');
            if (!parseTriggeredRef.current) {
                parseTriggeredRef.current = true;
                void api.repos.parse(repoId)
                    .then(() => refreshRepo())
                    .catch((err) => {
                        console.error('Parse trigger error:', err);
                        setErrors(prev => [...prev, `Parse: ${err instanceof Error ? err.message : 'Failed to parse repository'}`]);
                    });
            }
            return;
        }

        if (repo.status === 'PARSING') {
            setPipelineBusy(true);
            setPipelineMessage('Parsing modules and dependency graph...');
            return;
        }

        if (repo.status === 'PARSED') {
            if (!repo.storyboardId) {
                if (repo.storyboardErrorMessage) {
                    setPipelineBusy(false);
                    setPipelineMessage(`Storyboard generation failed: ${repo.storyboardErrorMessage}`);
                    return;
                }

                setPipelineBusy(true);
                setPipelineMessage('Generating storyboard blocks...');
                if (!storyboardTriggeredRef.current) {
                    storyboardTriggeredRef.current = true;
                    void api.storyboard.generate(repoId, role)
                        .then((result) => {
                            if (result.storyboardId) {
                                setActiveStoryboardId(result.storyboardId);
                            }
                            return refreshRepo();
                        })
                        .catch((err) => {
                            console.error('Storyboard trigger error:', err);
                            setErrors(prev => [...prev, `Storyboard: ${err instanceof Error ? err.message : 'Failed to generate storyboard'}`]);
                        });
                }
            } else {
                setPipelineBusy(false);
                setPipelineMessage(null);
            }
            return;
        }

        if (repo.status === 'GENERATING_STORYBOARD') {
            setPipelineBusy(true);
            setPipelineMessage('Generating storyboard blocks...');
            return;
        }

        if (repo.status === 'ERROR') {
            setPipelineBusy(false);
            const message = repo.errorMessage || 'Pipeline failed. Please retry with another repository or refresh.';
            setPipelineMessage(message);
        }
    }, [activeStoryboardId, refreshRepo, repo, repoId, role]);

    // Warm cache for likely next-open files
    useEffect(() => {
        if (!fileTree) return;

        const treeCandidates = getFileList(fileTree).slice(0, PREFETCH_TREE_SAMPLE_SIZE);
        const storyboardCandidates = (storyboard?.blocks || [])
            .flatMap(block => block.keyFiles || [])
            .slice(0, PREFETCH_BLOCK_SAMPLE_SIZE);

        void prefetchFiles([...storyboardCandidates, ...treeCandidates]);
    }, [fileTree, storyboard, prefetchFiles]);

    // Prefetch key files whenever active block changes
    useEffect(() => {
        if (!activeBlock?.keyFiles?.length) return;
        void prefetchFiles(activeBlock.keyFiles.slice(0, PREFETCH_BLOCK_SAMPLE_SIZE));
    }, [activeBlock, prefetchFiles]);

    // ---- Open a file ----
    const openFile = useCallback(async (path: string) => {
        const existing = openFiles.findIndex(f => f.path === path);
        if (existing >= 0) {
            setActiveFileIndex(existing);
            return;
        }

        try {
            const content = await fetchFileContent(path);
            setOpenFiles(prev => {
                const alreadyOpen = prev.findIndex(file => file.path === path);
                if (alreadyOpen >= 0) {
                    setActiveFileIndex(alreadyOpen);
                    return prev;
                }
                const next = [...prev, { path, content }];
                setActiveFileIndex(next.length - 1);
                return next;
            });
        } catch (err) {
            console.error('Failed to open file:', err);
            setErrors(prev => [...prev, `Could not open ${path}`]);
        }
    }, [openFiles, fetchFileContent]);

    // ---- Close a file tab ----
    const closeFile = useCallback((index: number) => {
        setOpenFiles(prev => prev.filter((_, i) => i !== index));
        if (activeFileIndex >= index) {
            setActiveFileIndex(Math.max(0, activeFileIndex - 1));
        }
    }, [activeFileIndex]);

    const visibleBlocks = useMemo(() => {
        const sorted = [...(storyboard?.blocks || [])]
            .sort((a, b) => a.order - b.order);

        if (role === 'fullstack') return sorted;

        const filtered = sorted.filter(block => blockMatchesRole(block, role));
        return filtered.length > 0 ? filtered : sorted;
    }, [storyboard, role]);

    const firstIncompleteIndex = visibleBlocks.findIndex(block => !completedBlocks.has(block.blockId));
    const unlockedBlockIndex = visibleBlocks.length === 0
        ? -1
        : (firstIncompleteIndex === -1 ? visibleBlocks.length - 1 : firstIncompleteIndex);
    const activeBlockIndex = activeBlock
        ? visibleBlocks.findIndex(block => block.blockId === activeBlock.blockId)
        : -1;
    const totalBlocks = visibleBlocks.length;
    const completedCount = visibleBlocks.filter(block => completedBlocks.has(block.blockId)).length;
    const progressPercent = totalBlocks > 0 ? (completedCount / totalBlocks) * 100 : 0;
    const activeBlockCompleted = activeBlock ? completedBlocks.has(activeBlock.blockId) : false;
    const canGoPrev = activeBlockIndex > 0;
    const canGoNext = (
        activeBlockIndex >= 0
        && activeBlockIndex < totalBlocks - 1
        && activeBlockCompleted
    );
    const nextBlockLocked = Boolean(
        activeBlockIndex >= 0
        && activeBlockIndex < totalBlocks - 1
        && activeBlock
        && !activeBlockCompleted
    );

    const activateBlock = useCallback((block: StoryboardBlock) => {
        setActiveBlock(block);
        setChatMessages([]);
        setHighlightedLines(new Set());
        if (block.keyFiles?.length > 0) {
            void prefetchFiles(block.keyFiles.slice(0, PREFETCH_BLOCK_SAMPLE_SIZE));
            void openFile(block.keyFiles[0]);
        }
    }, [openFile, prefetchFiles]);

    useEffect(() => {
        if (visibleBlocks.length === 0) {
            if (activeBlock !== null) {
                setActiveBlock(null);
                setChatMessages([]);
            }
            return;
        }

        const currentIndex = activeBlock
            ? visibleBlocks.findIndex(block => block.blockId === activeBlock.blockId)
            : -1;

        if (currentIndex >= 0 && currentIndex <= unlockedBlockIndex) {
            return;
        }

        const nextIndex = Math.max(0, Math.min(unlockedBlockIndex, visibleBlocks.length - 1));
        activateBlock(visibleBlocks[nextIndex]);
    }, [activeBlock, activateBlock, unlockedBlockIndex, visibleBlocks]);

    // ---- Select block ----
    const selectBlock = useCallback((block: StoryboardBlock, forceSelection = false) => {
        const blockIndex = visibleBlocks.findIndex(item => item.blockId === block.blockId);
        if (blockIndex === -1) return;
        if (!forceSelection && blockIndex > unlockedBlockIndex) return;
        activateBlock(block);
    }, [activateBlock, unlockedBlockIndex, visibleBlocks]);

    // ---- Toggle block completion ----
    const toggleBlockComplete = useCallback((blockId: string) => {
        const blockIndex = visibleBlocks.findIndex(block => block.blockId === blockId);
        if (blockIndex < 0) return;

        const isCurrentlyComplete = completedBlocks.has(blockId);

        setCompletedBlocks(prev => {
            const next = new Set(prev);

            if (isCurrentlyComplete) {
                next.delete(blockId);
                for (let i = blockIndex + 1; i < visibleBlocks.length; i += 1) {
                    next.delete(visibleBlocks[i].blockId);
                }
            } else {
                next.add(blockId);
            }

            return next;
        });

        if (!isCurrentlyComplete) {
            api.progress.completeBlock('anonymous', repoId, blockId).catch(console.error);
        }
    }, [completedBlocks, repoId, visibleBlocks]);

    const goToPreviousBlock = useCallback(() => {
        if (!canGoPrev) return;
        const prev = visibleBlocks[activeBlockIndex - 1];
        if (prev) selectBlock(prev, true);
    }, [activeBlockIndex, canGoPrev, selectBlock, visibleBlocks]);

    const goToNextBlock = useCallback(() => {
        if (!canGoNext) return;
        const next = visibleBlocks[activeBlockIndex + 1];
        if (next) selectBlock(next, true);
    }, [activeBlockIndex, canGoNext, selectBlock, visibleBlocks]);

    // ---- Send chat message ----
    const sendChat = useCallback(async () => {
        if (!chatInput.trim() || !activeStoryboardId || !activeBlock) return;

        const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setChatLoading(true);

        try {
            const { response } = await api.chat.send(activeStoryboardId, activeBlock.blockId, userMsg.content);
            setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (err) {
            console.error('Chat error:', err);
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Failed to get a response. Please try again.',
            }]);
        } finally {
            setChatLoading(false);
        }
    }, [activeStoryboardId, activeBlock, chatInput]);

    // ---- Dismiss error ----
    const dismissError = useCallback((index: number) => {
        setErrors(prev => prev.filter((_, i) => i !== index));
    }, []);

    if (loading) {
        return (
            <div className="loading-spinner" style={{ height: '100vh' }}>
                <div className="spinner" />
            </div>
        );
    }

    const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
    const pipelineState = repo?.status === 'ERROR' ? 'error' : (pipelineBusy ? 'busy' : 'idle');

    return (
        <div className="workspace">
            {/* ---- Top Bar ---- */}
            <div className="topbar">
                <div className="topbar-left">
                    <div className="window-controls" aria-hidden="true">
                        <span className="window-control red" />
                        <span className="window-control yellow" />
                        <span className="window-control green" />
                    </div>
                    <div className="topbar-brand">
                        <Codicon name="code" />
                        <span>Forge</span>
                    </div>
                    {repo && (
                        <div className="topbar-repo-name">
                            {repo.name}
                        </div>
                    )}
                </div>
                <div className="topbar-center">
                    <div className="topbar-title">
                        {activeFile ? `${getFileName(activeFile.path)} — ${repo?.name || 'Forge'}` : `${repo?.name || 'Forge'} — Visual Studio Code`}
                    </div>
                </div>
                <div className="topbar-right">
                    <div className="role-selector">
                        {ROLES.map(r => (
                            <button
                                key={r.value}
                                className={`role-option ${role === r.value ? 'active' : ''}`}
                                onClick={() => setRole(r.value)}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                    <span className="repo-stats">{repo?.fileCount || 0} files · {totalBlocks} blocks</span>
                </div>
            </div>

            {/* ---- Activity Bar ---- */}
            <div className="activity-bar">
                <div
                    className={`activity-bar-icon ${sidebarView === 'explorer' && !sidebarCollapsed ? 'active' : ''}`}
                    onClick={() => { setSidebarView('explorer'); setSidebarCollapsed(false); }}
                    title="Explorer (⌘B)"
                >
                    <Codicon name="files" />
                </div>
                <div
                    className={`activity-bar-icon ${sidebarView === 'search' && !sidebarCollapsed ? 'active' : ''}`}
                    onClick={() => { setSidebarView('search'); setSidebarCollapsed(false); }}
                    title="Search"
                >
                    <Codicon name="search" />
                </div>
                <div
                    className={`activity-bar-icon ${sidebarView === 'storyboard' && !sidebarCollapsed ? 'active' : ''}`}
                    onClick={() => { setSidebarView('storyboard'); setSidebarCollapsed(false); }}
                    title="Storyboard Blocks"
                >
                    <Codicon name="source-control" />
                    {totalBlocks > 0 && (
                        <span className="badge-count">{totalBlocks}</span>
                    )}
                </div>
                <div className="activity-bar-icon" title="Run and Debug">
                    <Codicon name="run-all" />
                </div>
                <div className="activity-bar-icon" title="Extensions">
                    <Codicon name="extensions" />
                </div>
                <div className="activity-bar-spacer" />
                <div
                    className="activity-bar-icon"
                    onClick={() => setShowCommandPalette(true)}
                    title="Command Palette (⌘K)"
                >
                    <Codicon name="command-palette" />
                </div>
                <div className="activity-bar-icon" title="Account">
                    <Codicon name="account" />
                </div>
                <div className="activity-bar-icon" title="Settings">
                    <Codicon name="settings-gear" />
                </div>
            </div>

            {/* ---- Sidebar ---- */}
            <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                {sidebarView === 'explorer' && (
                    <>
                        <div className="sidebar-header">
                            <span>Explorer</span>
                            <div className="sidebar-header-actions" aria-hidden="true">
                                <button className="icon-btn">
                                    <Codicon name="ellipsis" />
                                </button>
                            </div>
                        </div>
                        <div className="sidebar-search">
                            <input
                                type="text"
                                placeholder="Filter files..."
                                value={treeFilter}
                                onChange={e => setTreeFilter(e.target.value)}
                            />
                        </div>
                        <div className="sidebar-content">
                            {fileTree ? (
                                <FileTreeNode
                                    node={fileTree}
                                    onFileClick={openFile}
                                    onFileHover={prefetchFile}
                                    filter={treeFilter}
                                    activeFilePath={activeFile?.path}
                                    setiTheme={setiTheme}
                                />
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><Codicon name="folder" /></div>
                                    <div className="empty-state-text">
                                        {errors.length > 0 ? 'Could not load file tree' : 'No files found'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
                {sidebarView === 'search' && (
                    <>
                        <div className="sidebar-header">
                            <span>Search</span>
                        </div>
                        <div className="sidebar-search">
                            <input
                                type="text"
                                placeholder="Search in repo..."
                            />
                        </div>
                        <div className="sidebar-content">
                            <div className="empty-state">
                                <div className="empty-state-icon"><Codicon name="search" /></div>
                                <div className="empty-state-text">Type to search across all files in the repository</div>
                            </div>
                        </div>
                    </>
                )}
                {sidebarView === 'storyboard' && (
                    <>
                        <div className="sidebar-header">
                            <span>Storyboard Blocks</span>
                        </div>
                        <div className="sidebar-content">
                            <MiniBlockList
                                blocks={visibleBlocks}
                                activeBlock={activeBlock}
                                completedBlocks={completedBlocks}
                                unlockedBlockIndex={unlockedBlockIndex}
                                onSelectBlock={selectBlock}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* ---- Editor Panel ---- */}
            <div className="editor-panel">
                {/* Error Banner */}
                {errors.length > 0 && (
                    <div>
                        {errors.map((err, i) => (
                            <div key={i} className="error-banner">
                                <span className="error-banner-icon"><Codicon name="warning" /></span>
                                <span className="error-banner-text">{err}</span>
                                <button className="error-banner-dismiss" onClick={() => dismissError(i)}>
                                    <Codicon name="close" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {pipelineMessage && (
                    <div className={`pipeline-banner ${pipelineState}`}>
                        <span className="pipeline-banner-icon">
                            <Codicon
                                name={pipelineState === 'error' ? 'warning' : (pipelineBusy ? 'sync' : 'check')}
                                className={pipelineBusy ? 'spin' : ''}
                            />
                        </span>
                        <span className="pipeline-banner-text">{pipelineMessage}</span>
                    </div>
                )}

                {/* Tabs */}
                {openFiles.length > 0 && (
                    <div className="editor-tabs">
                        {openFiles.map((file, i) => (
                            <div
                                key={file.path}
                                className={`editor-tab ${i === activeFileIndex ? 'active' : ''}`}
                                onClick={() => setActiveFileIndex(i)}
                            >
                                <SetiIcon theme={setiTheme} kind="file" name={getFileName(file.path)} className="tab-icon" />
                                <span>{getFileName(file.path)}</span>
                                <span
                                    className="editor-tab-close"
                                    onClick={(e) => { e.stopPropagation(); closeFile(i); }}
                                >
                                    <Codicon name="close" />
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Breadcrumbs */}
                {activeFile && (
                    <div className="editor-breadcrumbs">
                        {activeFile.path.split('/').map((part, i, arr) => (
                            <span key={i}>
                                {i > 0 && (
                                    <span className="breadcrumb-sep">
                                        <Codicon name="chevron-right" />
                                    </span>
                                )}
                                <span className={`breadcrumb-item ${i === arr.length - 1 ? 'last' : ''}`}>
                                    {part}
                                </span>
                            </span>
                        ))}
                    </div>
                )}

                <div className="editor-content">
                    {activeFile ? (
                        <CodeViewer
                            content={activeFile.content}
                            filePath={activeFile.path}
                            highlightedLines={highlightedLines}
                        />
                    ) : (
                        <div className="editor-welcome">
                            <div className="editor-welcome-logo"><Codicon name="code" /></div>
                            <h2>Start by opening a file</h2>
                            <p>
                                Select a storyboard block on the right to start learning,
                                or browse the file tree to read the source code directly.
                            </p>
                            <div className="welcome-shortcuts">
                                <div className="welcome-shortcut">
                                    <kbd>⌘ K</kbd>
                                    <span>Command Palette</span>
                                </div>
                                <div className="welcome-shortcut">
                                    <kbd>⌘ B</kbd>
                                    <span>Toggle Sidebar</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ---- Right Panel ---- */}
            <div className="right-panel">
                <div className="panel-content">
                    <StoryboardPanel
                        blocks={visibleBlocks}
                        activeBlock={activeBlock}
                        activeBlockIndex={activeBlockIndex}
                        unlockedBlockIndex={unlockedBlockIndex}
                        completedBlocks={completedBlocks}
                        completedCount={completedCount}
                        progressPercent={progressPercent}
                        nextBlockLocked={nextBlockLocked}
                        canGoPrev={canGoPrev}
                        canGoNext={canGoNext}
                        setiTheme={setiTheme}
                        chatMessages={chatMessages}
                        chatInput={chatInput}
                        chatLoading={chatLoading}
                        onToggleComplete={toggleBlockComplete}
                        onOpenFile={openFile}
                        onChatInputChange={setChatInput}
                        onSendChat={sendChat}
                        onGoPrev={goToPreviousBlock}
                        onGoNext={goToNextBlock}
                    />
                </div>
            </div>

            {/* ---- Status Bar ---- */}
            <div className="statusbar">
                <div className="statusbar-left">
                    <div className="statusbar-item"><Codicon name="code" /> Forge</div>
                    <div className="statusbar-item">
                        {activeBlock ? activeBlock.title : 'No block selected'}
                    </div>
                </div>
                <div className="statusbar-right">
                    {activeFile && (
                        <div className="statusbar-item">
                            {getLanguageName(activeFile.path)}
                        </div>
                    )}
                    {pipelineMessage && (
                        <div className="statusbar-item">
                            {pipelineBusy
                                ? 'Building storyboard…'
                                : (repo?.status === 'ERROR' ? 'Pipeline error' : 'Storyboard ready')}
                        </div>
                    )}
                    <div className="statusbar-item">
                        {completedCount}/{totalBlocks}
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                    <div className="statusbar-item">{role}</div>
                </div>
            </div>

            {/* ---- Command Palette ---- */}
            {showCommandPalette && (
                <CommandPalette
                    onClose={() => setShowCommandPalette(false)}
                    onToggleSidebar={() => setSidebarCollapsed(v => !v)}
                    onSwitchRole={setRole}
                    fileTree={fileTree}
                    setiTheme={setiTheme}
                    onOpenFile={(path: string) => { openFile(path); setShowCommandPalette(false); }}
                />
            )}
        </div>
    );
}

// =============== Sub-Components ===============

// ---- File Tree ----
function FileTreeNode({ node, onFileClick, onFileHover, depth = 0, filter = '', activeFilePath, setiTheme }: {
    node: FileNode;
    onFileClick: (path: string) => void;
    onFileHover?: (path: string) => void;
    depth?: number;
    filter?: string;
    activeFilePath?: string;
    setiTheme?: SetiIconTheme | null;
}) {
    const [expanded, setExpanded] = useState(depth < 2);

    // Filter logic
    const matchesFilter = (n: FileNode): boolean => {
        if (!filter) return true;
        const lf = filter.toLowerCase();
        if (n.name.toLowerCase().includes(lf)) return true;
        if (n.children) return n.children.some(c => matchesFilter(c));
        return false;
    };

    if (!matchesFilter(node)) return null;

    if (node.type === 'file') {
        const isActive = node.path === activeFilePath;
        return (
            <div
                className={`file-tree-item ${isActive ? 'active' : ''}`}
                style={{ paddingLeft: 12 + depth * 16 }}
                onClick={() => node.path && onFileClick(node.path)}
                onMouseEnter={() => node.path && onFileHover?.(node.path)}
            >
                <SetiIcon theme={setiTheme} kind="file" name={node.name} className="tree-file-icon" />
                <span className="name">{node.name}</span>
            </div>
        );
    }

    return (
        <div className="file-tree-dir">
            <div
                className="file-tree-item"
                style={{ paddingLeft: 12 + depth * 16 }}
                onClick={() => setExpanded(!expanded)}
            >
                <span className="icon tree-chevron"><Codicon name={expanded ? 'chevron-down' : 'chevron-right'} /></span>
                <SetiIcon
                    theme={setiTheme}
                    kind={expanded ? 'folderExpanded' : 'folder'}
                    name={node.name}
                    className="tree-folder-icon"
                />
                <span className="name" style={{ fontWeight: depth === 0 ? 500 : 400 }}>{node.name}</span>
            </div>
            {expanded && node.children && (
                <div className="file-tree-children">
                    {[...node.children]
                        .sort(sortTreeNodes)
                        .filter(child => matchesFilter(child))
                        .map((child, i) => (
                            <FileTreeNode
                                key={`${child.name}-${i}`}
                                node={child}
                                onFileClick={onFileClick}
                                onFileHover={onFileHover}
                                depth={depth + 1}
                                filter={filter}
                                activeFilePath={activeFilePath}
                                setiTheme={setiTheme}
                            />
                        ))}
                </div>
            )}
        </div>
    );
}

// ---- Code Viewer with Syntax Highlighting ----
function CodeViewer({ content, filePath, highlightedLines }: {
    content: string;
    filePath: string;
    highlightedLines: Set<number>;
}) {
    const lines = content.split('\n');
    const lang = getLanguageFromPath(filePath);

    return (
        <div className="code-viewer">
            {lines.map((line, i) => (
                <div
                    key={i}
                    className={`code-line ${highlightedLines.has(i + 1) ? 'highlighted' : ''}`}
                >
                    <span className="code-line-number">{i + 1}</span>
                    <span
                        className="code-line-content"
                        dangerouslySetInnerHTML={{ __html: highlightSyntax(line, lang) }}
                    />
                </div>
            ))}
        </div>
    );
}

function MermaidDiagram({ diagram, compact = false }: { diagram: string; compact?: boolean }) {
    const source = typeof diagram === 'string' ? diagram.trim() : '';
    const [svg, setSvg] = useState('');
    const [renderError, setRenderError] = useState<string | null>(null);
    const stableId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const instanceIdRef = useRef(`forge-mermaid-${stableId}`);

    useEffect(() => {
        let cancelled = false;
        if (!source) return;

        async function renderDiagram() {
            try {
                const mermaid = await loadMermaidApi();
                if (cancelled) return;
                const result = await mermaid.render(instanceIdRef.current, source);
                if (cancelled) return;
                setSvg(result.svg || '');
                setRenderError(null);
            } catch (err) {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : 'Could not render diagram';
                setRenderError(message);
                setSvg('');
            }
        }

        void renderDiagram();
        return () => {
            cancelled = true;
        };
    }, [source]);

    if (!source) {
        return null;
    }

    if (renderError) {
        return (
            <div className={`mermaid-fallback ${compact ? 'compact' : ''}`.trim()}>
                <div className="mermaid-error">{renderError}</div>
                <pre>{diagram}</pre>
            </div>
        );
    }

    if (!svg) {
        return <div className="mermaid-loading">Rendering diagram…</div>;
    }

    return (
        <div
            className={`mermaid-render ${compact ? 'compact' : ''}`.trim()}
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}

function AssistantMessageContent({ content }: { content: string }) {
    const segments = useMemo(() => splitContentByMermaid(content), [content]);

    return (
        <div className="assistant-message-content">
            {segments.map((segment, index) => {
                if (segment.kind === 'mermaid') {
                    return (
                        <div key={`${segment.kind}-${index}`} className="chat-mermaid-block">
                            <MermaidDiagram diagram={segment.value} compact />
                        </div>
                    );
                }

                if (!segment.value.trim()) return null;
                return (
                    <div
                        key={`${segment.kind}-${index}`}
                        dangerouslySetInnerHTML={{ __html: simpleMarkdown(segment.value) }}
                    />
                );
            })}
        </div>
    );
}

function splitContentByMermaid(content: string): { kind: 'text' | 'mermaid'; value: string }[] {
    if (typeof content !== 'string' || !content) return [{ kind: 'text', value: '' }];

    const segments: { kind: 'text' | 'mermaid'; value: string }[] = [];
    const regex = /```mermaid\s*([\s\S]*?)```/gi;
    let cursor = 0;
    let match: RegExpExecArray | null = regex.exec(content);

    while (match) {
        const start = match.index;
        if (start > cursor) {
            segments.push({ kind: 'text', value: content.slice(cursor, start) });
        }

        const diagram = typeof match[1] === 'string' ? match[1].trim() : '';
        if (diagram) {
            segments.push({ kind: 'mermaid', value: diagram });
        }

        cursor = regex.lastIndex;
        match = regex.exec(content);
    }

    if (cursor < content.length) {
        segments.push({ kind: 'text', value: content.slice(cursor) });
    }

    if (segments.length === 0) {
        segments.push({ kind: 'text', value: content });
    }

    return segments;
}

// ---- Mini Block List for sidebar ----
function MiniBlockList({ blocks, activeBlock, completedBlocks, unlockedBlockIndex, onSelectBlock }: {
    blocks: StoryboardBlock[];
    activeBlock: StoryboardBlock | null;
    completedBlocks: Set<string>;
    unlockedBlockIndex: number;
    onSelectBlock: (block: StoryboardBlock) => void;
}) {
    if (blocks.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon"><Codicon name="symbol-structure" /></div>
                <div className="empty-state-text">
                    No storyboard blocks yet. Generate a storyboard to see learning modules here.
                </div>
            </div>
        );
    }

    return (
        <div className="block-list">
            {blocks.map((block, index) => {
                const isCompleted = completedBlocks.has(block.blockId);
                const isLocked = index > unlockedBlockIndex;
                const isActive = activeBlock?.blockId === block.blockId;

                return (
                    <button
                        type="button"
                        key={block.blockId}
                        className={`block-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}
                        onClick={() => onSelectBlock(block)}
                        disabled={isLocked}
                        style={{ padding: '6px 8px' }}
                    >
                        <div className="block-check" style={{ width: 16, height: 16, fontSize: 9 }}>
                            {isCompleted ? '✓' : (isLocked ? <Codicon name="lock" /> : index + 1)}
                        </div>
                        <div className="block-info">
                            <div className="block-title" style={{ fontSize: 12 }}>{block.title}</div>
                            {isLocked && (
                                <div className="block-locked-note">Complete the previous block to unlock.</div>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// ---- Storyboard Panel ----
function StoryboardPanel({
    blocks,
    activeBlock,
    activeBlockIndex,
    unlockedBlockIndex,
    completedBlocks,
    completedCount,
    progressPercent,
    nextBlockLocked,
    canGoPrev,
    canGoNext,
    setiTheme,
    chatMessages,
    chatInput,
    chatLoading,
    onToggleComplete,
    onOpenFile,
    onChatInputChange,
    onSendChat,
    onGoPrev,
    onGoNext,
}: {
    blocks: StoryboardBlock[];
    activeBlock: StoryboardBlock | null;
    activeBlockIndex: number;
    unlockedBlockIndex: number;
    completedBlocks: Set<string>;
    completedCount: number;
    progressPercent: number;
    nextBlockLocked: boolean;
    canGoPrev: boolean;
    canGoNext: boolean;
    setiTheme: SetiIconTheme | null;
    chatMessages: ChatMessage[];
    chatInput: string;
    chatLoading: boolean;
    onToggleComplete: (blockId: string) => void;
    onOpenFile: (path: string) => void;
    onChatInputChange: (value: string) => void;
    onSendChat: () => void;
    onGoPrev: () => void;
    onGoNext: () => void;
}) {
    if (blocks.length === 0) {
        return (
            <div className="empty-state" style={{ height: '100%' }}>
                <div className="empty-state-icon"><Codicon name="symbol-structure" /></div>
                <div className="empty-state-text">
                    No storyboard blocks generated yet.
                    The storyboard will appear here once generated.
                </div>
            </div>
        );
    }

    const fallbackBlock = blocks[Math.max(0, Math.min(unlockedBlockIndex, blocks.length - 1))];
    const currentBlock = (activeBlock && blocks.find(block => block.blockId === activeBlock.blockId)) || fallbackBlock;
    const currentBlockComplete = completedBlocks.has(currentBlock.blockId);

    return (
        <div className="block-detail animate-fade-in">
            <div className="block-navigation">
                <button type="button" className="btn-secondary block-nav-btn" onClick={onGoPrev} disabled={!canGoPrev}>
                    ← Previous
                </button>
                <div className="block-nav-status">
                    {Math.max(1, activeBlockIndex + 1)} / {blocks.length}
                </div>
                <button type="button" className="btn-secondary block-nav-btn" onClick={onGoNext} disabled={!canGoNext}>
                    Next →
                </button>
            </div>

            {nextBlockLocked && (
                <div className="sequential-hint">
                    <Codicon name="lock" />
                    Complete this block to unlock the next step.
                </div>
            )}

            <div className="block-detail-header">
                <div className="block-detail-meta">
                    <span className="block-time">Step {Math.max(1, activeBlockIndex + 1)} of {blocks.length}</span>
                    <span className="block-time">~{currentBlock.estimatedMinutes} min</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {currentBlock.roleTags?.map(tag => (
                        <span key={tag} className={`badge badge-${tag}`}>{tag}</span>
                    ))}
                </div>
                <div className="block-detail-title">{currentBlock.title}</div>
                <div className="block-detail-objective">{currentBlock.objective}</div>
            </div>

            <div className="block-detail-section">
                <div className="block-detail-section-title">Explanation</div>
                <div className="markdown-content">
                    <div dangerouslySetInnerHTML={{ __html: simpleMarkdown(currentBlock.explanationMarkdown || '') }} />
                </div>
            </div>

            {currentBlock.mermaidDiagram && (
                <div className="block-detail-section">
                    <div className="block-detail-section-title">Diagram</div>
                    <div className="mermaid-container">
                        <MermaidDiagram diagram={currentBlock.mermaidDiagram} />
                    </div>
                </div>
            )}

            {currentBlock.keyFiles?.length > 0 && (
                <div className="block-detail-section">
                    <div className="block-detail-section-title">Key Files</div>
                    <div className="block-files-list">
                        {currentBlock.keyFiles.map(filePath => (
                            <button key={filePath} type="button" className="block-file-link" onClick={() => onOpenFile(filePath)}>
                                <SetiIcon theme={setiTheme} kind="file" name={getFileName(filePath)} className="inline-file-icon" /> {filePath}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {currentBlock.resources?.length > 0 && (
                <div className="block-detail-section">
                    <div className="block-detail-section-title">Resources</div>
                    <div className="resource-list">
                        {currentBlock.resources.map((resource, index) => {
                            const parsed = parseResource(resource);
                            if (!parsed.url) {
                                return (
                                    <span key={`${resource}-${index}`} className="resource-link resource-link-muted">
                                        <Codicon name="link-external" />
                                        {parsed.label}
                                    </span>
                                );
                            }

                            return (
                                <a
                                    key={`${resource}-${index}`}
                                    href={parsed.url}
                                    className="resource-link"
                                    target="_blank"
                                    rel="noreferrer noopener"
                                >
                                    <Codicon name="link-external" />
                                    {parsed.label}
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}

            {currentBlock.keyTakeaways && currentBlock.keyTakeaways.length > 0 && (
                <div className="block-detail-section">
                    <div className="block-detail-section-title">Key Takeaways</div>
                    <div className="takeaway-list">
                        {currentBlock.keyTakeaways.map((takeaway, i) => (
                            <div key={i} className="takeaway-item">
                                <span className="takeaway-icon">✓</span>
                                <span>{takeaway}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="block-detail-section">
                <div className="block-detail-section-title">Chat About This Block</div>
                <ChatPanel
                    messages={chatMessages}
                    input={chatInput}
                    loading={chatLoading}
                    activeBlock={currentBlock}
                    onInputChange={onChatInputChange}
                    onSend={onSendChat}
                    embedded
                />
            </div>

            <button
                className={currentBlockComplete ? 'btn-secondary' : 'btn-primary'}
                onClick={() => onToggleComplete(currentBlock.blockId)}
                style={{ width: '100%', marginTop: 16 }}
            >
                {currentBlockComplete ? '↺ Mark Incomplete' : '✓ Mark as Complete'}
            </button>

            <div className="guided-bottom-progress">
                <div className="guided-bottom-progress-meta">{completedCount} of {blocks.length} completed</div>
                <div className="progress-bar block-progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                </div>
            </div>
        </div>
    );
}

// ---- Chat Panel ----
function ChatPanel({ messages, input, loading, activeBlock, onInputChange, onSend, embedded = false }: {
    messages: ChatMessage[];
    input: string;
    loading: boolean;
    activeBlock: StoryboardBlock | null;
    onInputChange: (value: string) => void;
    onSend: () => void;
    embedded?: boolean;
}) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className={`chat-container ${embedded ? 'embedded' : ''}`.trim()}>
            {!activeBlock ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p>Select a storyboard block to start chatting about it.</p>
                </div>
            ) : (
                <>
                    {!embedded && (
                        <div className="chat-header">
                            <span className="chat-header-label">Chat</span>
                            <strong style={{ color: 'var(--accent)' }}>{activeBlock.title}</strong>
                        </div>
                    )}

                    <div className="chat-messages">
                        {messages.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>
                                Ask anything about this block. Your questions will be answered using the block&apos;s source code and documentation as context.
                                {activeBlock.suggestedQuestions && activeBlock.suggestedQuestions.length > 0 && (
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Suggested questions:</div>
                                        {activeBlock.suggestedQuestions.map((q, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                className="chat-suggested-question"
                                                onClick={() => onInputChange(q)}
                                            >
                                                → {q}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {messages.map((msg, i) => (
                            <div key={i} className={`chat-message ${msg.role}`}>
                                <div className="chat-message-role">
                                    {msg.role === 'user' ? 'You' : 'Forge'}
                                </div>
                                <div className="chat-message-content">
                                    {msg.role === 'assistant' ? (
                                        <AssistantMessageContent content={msg.content} />
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="chat-message assistant">
                                <div className="chat-message-role">Forge</div>
                                <div className="chat-message-content">
                                    <span style={{ animation: 'pulse 1.5s ease infinite' }}>Thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-input-area">
                        <div className="chat-input-wrapper">
                            <input
                                className="chat-input"
                                type="text"
                                placeholder="Ask about this block..."
                                value={input}
                                onChange={(e) => onInputChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && onSend()}
                                disabled={loading}
                            />
                            <button
                                className="chat-send-btn"
                                onClick={onSend}
                                disabled={loading || !input.trim()}
                            >
                                <Codicon name="arrow-right" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ---- Command Palette ----
function CommandPalette({ onClose, onToggleSidebar, onSwitchRole, fileTree, setiTheme, onOpenFile }: {
    onClose: () => void;
    onToggleSidebar: () => void;
    onSwitchRole: (role: Role) => void;
    fileTree: FileNode | null;
    setiTheme: SetiIconTheme | null;
    onOpenFile: (path: string) => void;
}) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const commands: { icon: ReactNode; label: string; shortcut: string; action: () => void }[] = [
        { icon: <Codicon name="files" />, label: 'Toggle Sidebar', shortcut: '⌘B', action: () => { onToggleSidebar(); onClose(); } },
        { icon: <Codicon name="symbol-structure" />, label: 'Switch to Full Stack', shortcut: '', action: () => { onSwitchRole('fullstack'); onClose(); } },
        { icon: <Codicon name="symbol-color" />, label: 'Switch to Frontend', shortcut: '', action: () => { onSwitchRole('frontend'); onClose(); } },
        { icon: <Codicon name="server" />, label: 'Switch to Backend', shortcut: '', action: () => { onSwitchRole('backend'); onClose(); } },
        { icon: <Codicon name="tools" />, label: 'Switch to Infra', shortcut: '', action: () => { onSwitchRole('infra'); onClose(); } },
    ];

    // Add open file commands from file tree
    const fileCommands = getFileList(fileTree).slice(0, 20).map(path => ({
        icon: <SetiIcon theme={setiTheme} kind="file" name={getFileName(path)} className="command-file-icon" />,
        label: path,
        shortcut: '',
        action: () => onOpenFile(path),
    }));

    const allCommands = [...commands, ...fileCommands];
    const filtered = query
        ? allCommands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
        : allCommands;

    return (
        <div className="command-palette-overlay" onClick={onClose}>
            <div className="command-palette" onClick={e => e.stopPropagation()}>
                <div className="command-palette-input">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a command or file name..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Escape') onClose();
                            if (e.key === 'Enter' && filtered.length > 0) filtered[0].action();
                        }}
                    />
                </div>
                <div className="command-palette-results">
                    {filtered.slice(0, 15).map((cmd, i) => (
                        <div
                            key={i}
                            className={`command-palette-item ${i === 0 ? 'selected' : ''}`}
                            onClick={cmd.action}
                        >
                            <span className="command-palette-item-icon">{cmd.icon}</span>
                            <span className="command-palette-item-label">{cmd.label}</span>
                            {cmd.shortcut && (
                                <span className="command-palette-item-shortcut">{cmd.shortcut}</span>
                            )}
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                            No results found
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


// =============== Helpers ===============

async function loadMermaidApi(): Promise<MermaidApi> {
    if (typeof window === 'undefined') {
        throw new Error('Mermaid is only available in the browser');
    }

    if (window.mermaid) {
        initializeMermaid(window.mermaid);
        return window.mermaid;
    }

    if (!window.__forgeMermaidLoader) {
        window.__forgeMermaidLoader = new Promise<MermaidApi>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[data-forge-mermaid="true"]');
            if (existing && window.mermaid) {
                initializeMermaid(window.mermaid);
                resolve(window.mermaid);
                return;
            }

            const script = existing || document.createElement('script');
            script.src = MERMAID_CDN_URL;
            script.async = true;
            script.setAttribute('data-forge-mermaid', 'true');

            script.onload = () => {
                if (!window.mermaid) {
                    reject(new Error('Mermaid failed to initialize'));
                    return;
                }
                initializeMermaid(window.mermaid);
                resolve(window.mermaid);
            };
            script.onerror = () => reject(new Error('Failed to load Mermaid'));

            if (!existing) {
                document.head.appendChild(script);
            }
        });
    }

    return window.__forgeMermaidLoader;
}

function initializeMermaid(mermaidApi: MermaidApi) {
    if (window.__forgeMermaidInitialized) return;

    mermaidApi.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
    });
    window.__forgeMermaidInitialized = true;
}

function getFileName(path: string): string {
    return path.split('/').pop() || path;
}

function sortTreeNodes(a: FileNode, b: FileNode): number {
    if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function normalizeRoleToken(value: string): string {
    return value
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
}

function blockMatchesRole(block: StoryboardBlock, role: Role): boolean {
    if (role === 'fullstack') return true;
    const tags = Array.isArray(block.roleTags) ? block.roleTags : [];
    if (tags.length === 0) return false;

    const normalizedRole = normalizeRoleToken(role);
    return tags.some(tag => {
        const token = normalizeRoleToken(String(tag));
        if (!token) return false;
        if (token === normalizedRole) return true;
        if (normalizedRole === 'frontend' && token.includes('front')) return true;
        if (normalizedRole === 'backend' && token.includes('back')) return true;
        if (normalizedRole === 'infra' && (token.includes('infra') || token.includes('devops') || token.includes('platform'))) return true;
        return false;
    });
}

function Codicon({ name, className = '', style }: { name: string; className?: string; style?: CSSProperties }) {
    return <i className={`codicon codicon-${name} ${className}`.trim()} style={style} aria-hidden="true" />;
}

function SetiIcon({ theme, kind, name, className = '' }: {
    theme: SetiIconTheme | null | undefined;
    kind: 'file' | 'folder' | 'folderExpanded';
    name: string;
    className?: string;
}) {
    const vscodeLikeIcon = resolveVscodeLikeIcon(kind, name);
    if (vscodeLikeIcon) {
        return renderVscodeLikeIcon(vscodeLikeIcon, className);
    }

    const iconMeta = resolveSetiIcon(theme, kind, name);

    if (iconMeta?.glyph) {
        const style = iconMeta.color ? ({ color: iconMeta.color } as CSSProperties) : undefined;
        return (
            <span className={`seti-icon ${className}`.trim()} style={style}>
                {iconMeta.glyph}
            </span>
        );
    }

    if (kind === 'folder' || kind === 'folderExpanded') {
        return <Codicon name={kind === 'folderExpanded' ? 'folder-opened' : 'folder'} className={className} />;
    }

    return <Codicon name="file" className={className} />;
}

function renderVscodeLikeIcon(icon: VscodeLikeIcon, className = '') {
    if (icon.type === 'badge') {
        return (
            <span
                className={`vscode-badge-icon ${className}`.trim()}
                style={{ color: icon.color, backgroundColor: icon.background }}
            >
                {icon.label}
            </span>
        );
    }

    return (
        <span className={`vscode-codicon-icon ${className}`.trim()} style={{ color: icon.color }}>
            <Codicon name={icon.codicon || 'file'} />
            {icon.dotColor && <span className="vscode-codicon-dot" style={{ backgroundColor: icon.dotColor }} />}
        </span>
    );
}

function resolveVscodeLikeIcon(kind: 'file' | 'folder' | 'folderExpanded', name: string): VscodeLikeIcon | null {
    const lowerName = name.toLowerCase();

    if (kind === 'folder' || kind === 'folderExpanded') {
        const folderVisuals: Record<string, { color: string; dotColor?: string }> = {
            '.next': { color: '#5ea1ff', dotColor: '#3b82f6' },
            'node_modules': { color: '#73d291', dotColor: '#22c55e' },
            'public': { color: '#b49efc', dotColor: '#8b5cf6' },
            src: { color: '#ffb86c', dotColor: '#f97316' },
            '.git': { color: '#f38ba8', dotColor: '#ef4444' },
        };

        const visual = folderVisuals[lowerName];
        return {
            type: 'codicon',
            codicon: kind === 'folderExpanded' ? 'folder-opened' : 'folder',
            color: visual?.color || '#dcb67a',
            dotColor: visual?.dotColor,
        };
    }

    const fileNameMap: Record<string, VscodeLikeIcon> = {
        'package.json': { type: 'badge', label: 'NPM', color: '#051b11', background: '#78e5a9' },
        'package-lock.json': { type: 'badge', label: 'LCK', color: '#f4f5f7', background: '#475569' },
        'tsconfig.json': { type: 'badge', label: 'TS', color: '#ffffff', background: '#3178c6' },
        'next.config.ts': { type: 'badge', label: 'NX', color: '#ffffff', background: '#3f3f46' },
        'next.config.js': { type: 'badge', label: 'NX', color: '#ffffff', background: '#3f3f46' },
        '.gitignore': { type: 'badge', label: 'GIT', color: '#111827', background: '#fb923c' },
        '.env': { type: 'badge', label: 'ENV', color: '#0f172a', background: '#86efac' },
        '.env.local': { type: 'badge', label: 'ENV', color: '#0f172a', background: '#86efac' },
        'readme.md': { type: 'badge', label: 'MD', color: '#f8fafc', background: '#2563eb' },
        'license': { type: 'badge', label: 'TXT', color: '#f8fafc', background: '#64748b' },
    };

    const byFileName = fileNameMap[lowerName];
    if (byFileName) return byFileName;

    const ext = lowerName.endsWith('.d.ts')
        ? 'd.ts'
        : (lowerName.split('.').pop() || '');

    const extensionMap: Record<string, VscodeLikeIcon> = {
        ts: { type: 'badge', label: 'TS', color: '#ffffff', background: '#3178c6' },
        'd.ts': { type: 'badge', label: 'DT', color: '#ffffff', background: '#2563eb' },
        tsx: { type: 'badge', label: 'TSX', color: '#ffffff', background: '#2563eb' },
        js: { type: 'badge', label: 'JS', color: '#111827', background: '#facc15' },
        jsx: { type: 'badge', label: 'JSX', color: '#111827', background: '#fcd34d' },
        json: { type: 'badge', label: '{}', color: '#111827', background: '#f59e0b' },
        md: { type: 'badge', label: 'MD', color: '#f8fafc', background: '#2563eb' },
        css: { type: 'badge', label: 'CSS', color: '#f8fafc', background: '#0ea5e9' },
        scss: { type: 'badge', label: 'SC', color: '#f8fafc', background: '#ec4899' },
        html: { type: 'badge', label: 'HTML', color: '#111827', background: '#fb923c' },
        yaml: { type: 'badge', label: 'YML', color: '#f8fafc', background: '#64748b' },
        yml: { type: 'badge', label: 'YML', color: '#f8fafc', background: '#64748b' },
        svg: { type: 'badge', label: 'SVG', color: '#111827', background: '#a3e635' },
        py: { type: 'badge', label: 'PY', color: '#f8fafc', background: '#3776ab' },
        go: { type: 'badge', label: 'GO', color: '#0f172a', background: '#7dd3fc' },
        rs: { type: 'badge', label: 'RS', color: '#f8fafc', background: '#7c3aed' },
        java: { type: 'badge', label: 'JV', color: '#f8fafc', background: '#ea580c' },
        sh: { type: 'badge', label: 'SH', color: '#f8fafc', background: '#334155' },
        sql: { type: 'badge', label: 'SQL', color: '#f8fafc', background: '#0f766e' },
    };

    return extensionMap[ext] || null;
}

function resolveSetiIcon(theme: SetiIconTheme | null | undefined, kind: 'file' | 'folder' | 'folderExpanded', name: string) {
    if (!theme?.iconDefinitions) return null;

    const normalizedName = name.toLowerCase();
    const iconId = kind === 'file'
        ? resolveSetiFileIconId(theme, normalizedName)
        : resolveSetiFolderIconId(theme, normalizedName, kind === 'folderExpanded');

    if (!iconId) return null;

    const definition = theme.iconDefinitions[iconId];
    if (!definition?.fontCharacter) return null;

    const glyph = fontCharacterToGlyph(definition.fontCharacter);
    if (!glyph) return null;

    return {
        glyph,
        color: definition.fontColor,
    };
}

function resolveSetiFileIconId(theme: SetiIconTheme, lowerName: string): string {
    const exactMatch = theme.fileNames?.[lowerName];
    if (exactMatch) return exactMatch;

    const parts = lowerName.split('.');
    if (parts.length > 1) {
        for (let i = 1; i < parts.length; i += 1) {
            const ext = parts.slice(i).join('.');
            const byExtension = theme.fileExtensions?.[ext];
            if (byExtension) return byExtension;
        }
    }

    return theme.file || '';
}

function resolveSetiFolderIconId(theme: SetiIconTheme, lowerName: string, expanded: boolean): string {
    if (expanded) {
        const folderNameExpanded = theme.folderNamesExpanded?.[lowerName];
        if (folderNameExpanded) return folderNameExpanded;
        return theme.folderExpanded || theme.rootFolderExpanded || theme.folder || '';
    }

    const folderName = theme.folderNames?.[lowerName];
    if (folderName) return folderName;

    return theme.folder || theme.rootFolder || '';
}

function fontCharacterToGlyph(fontCharacter: string): string {
    const normalized = fontCharacter.replace('\\', '');
    const codepoint = Number.parseInt(normalized, 16);
    if (Number.isNaN(codepoint)) return '';
    return String.fromCodePoint(codepoint);
}

/** Get language name for status bar */
function getLanguageName(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const names: Record<string, string> = {
        ts: 'TypeScript', tsx: 'TypeScript React', js: 'JavaScript', jsx: 'JavaScript React',
        py: 'Python', json: 'JSON', md: 'Markdown', yaml: 'YAML', yml: 'YAML',
        css: 'CSS', scss: 'SCSS', html: 'HTML', svg: 'SVG',
        sh: 'Shell', sql: 'SQL', go: 'Go', rs: 'Rust', java: 'Java', rb: 'Ruby',
        c: 'C', cpp: 'C++', h: 'C Header', cs: 'C#', swift: 'Swift',
    };
    return names[ext] || 'Plain Text';
}

/** Get language identifier from file path */
function getLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
        py: 'python', json: 'json', md: 'markdown', yaml: 'yaml', yml: 'yaml',
        css: 'css', scss: 'css', html: 'html', sh: 'shell',
        sql: 'sql', go: 'go', rs: 'rust', java: 'java', rb: 'ruby',
        c: 'c', cpp: 'c', h: 'c', cs: 'csharp', swift: 'swift',
    };
    return langMap[ext] || 'text';
}

/** Basic syntax highlighting using regex */
function highlightSyntax(line: string, lang: string): string {
    // Escape HTML
    let html = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    if (lang === 'text' || lang === 'markdown' || lang === 'json') {
        // JSON: highlight keys and strings
        if (lang === 'json') {
            html = html
                .replace(/(&quot;|")((?:\\.|[^"\\])*)(&quot;|")(\s*:)/g, '<span class="tok-property">$1$2$3</span>$4')
                .replace(/(&quot;|")((?:\\.|[^"\\])*)(&quot;|")/g, '<span class="tok-string">$1$2$3</span>')
                .replace(/\b(true|false|null)\b/g, '<span class="tok-constant">$1</span>')
                .replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-number">$1</span>');
        }
        return html;
    }

    // Comments: // and #
    const commentMatch = html.match(/^(\s*)(\/\/.*|#!?.*)/);
    if (commentMatch) {
        return `${commentMatch[1]}<span class="tok-comment">${commentMatch[2]}</span>`;
    }
    // Multi-line comment markers
    if (html.trim().startsWith('/*') || html.trim().startsWith('*') || html.trim().startsWith('*/')) {
        return `<span class="tok-comment">${html}</span>`;
    }

    // Strings (single and double quoted)
    html = html.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="tok-string">$&</span>');

    // Decorators
    html = html.replace(/@[\w.]+/g, '<span class="tok-decorator">$&</span>');

    // Keywords
    const keywords = lang === 'python'
        ? /\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|yield|async|await|raise|pass|break|continue|and|or|not|in|is|lambda|self|True|False|None)\b/g
        : /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|extends|implements|interface|type|enum|import|export|from|default|async|await|yield|try|catch|finally|throw|new|delete|typeof|instanceof|void|this|super|static|public|private|protected|readonly|abstract|override|get|set|true|false|null|undefined)\b/g;

    html = html.replace(keywords, '<span class="tok-keyword">$&</span>');

    // Numbers
    html = html.replace(/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/gi, '<span class="tok-number">$&</span>');

    // Function calls
    html = html.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, '<span class="tok-function">$&</span>');

    // Type annotations (capitalized words, common patterns)
    html = html.replace(/(?<=:\s*|&lt;|,\s*)([A-Z][a-zA-Z0-9_]*)/g, '<span class="tok-type">$&</span>');

    return html;
}

/** Collect flat list of file paths from tree */
function getFileList(node: FileNode | null): string[] {
    if (!node) return [];
    const results: string[] = [];
    if (node.type === 'file' && node.path) {
        results.push(node.path);
    }
    if (node.children) {
        for (const child of node.children) {
            results.push(...getFileList(child));
        }
    }
    return results;
}

function parseResource(resource: unknown): { label: string; url?: string } {
    if (resource == null) return { label: 'Reference' };

    if (typeof resource === 'string') {
        return parseResourceString(resource);
    }

    if (typeof resource === 'number' || typeof resource === 'boolean') {
        return { label: String(resource) };
    }

    if (Array.isArray(resource)) {
        const firstUsable = resource.find(item => item != null);
        return parseResource(firstUsable ?? 'Reference');
    }

    if (typeof resource === 'object') {
        const record = resource as Record<string, unknown>;
        const url = typeof record.url === 'string'
            ? record.url
            : (typeof record.href === 'string' ? record.href : undefined);
        const label = typeof record.label === 'string'
            ? record.label
            : (typeof record.title === 'string' ? record.title : undefined);

        if (label || url) {
            return parseResourceString(label && url ? `[${label}](${url})` : (label || url || 'Reference'));
        }
    }

    return { label: 'Reference' };
}

function parseResourceString(raw: string): { label: string; url?: string } {
    const trimmed = raw.trim();
    if (!trimmed) return { label: 'Reference' };

    const markdownLink = trimmed.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i);
    if (markdownLink) {
        return { label: markdownLink[1], url: markdownLink[2] };
    }

    const firstUrl = trimmed.match(/https?:\/\/[^\s)]+/i);
    if (firstUrl) {
        const normalizedUrl = firstUrl[0].replace(/[),.;]+$/, '');
        const label = trimmed.replace(firstUrl[0], '').replace(/^[\s:–-]+|[\s:–-]+$/g, '');
        return { label: label || normalizedUrl, url: normalizedUrl };
    }

    return { label: trimmed };
}

/** Very simple markdown-to-HTML (bold, italic, code, headings, links) */
function simpleMarkdown(md: string): string {
    return md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>')
        .replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer noopener">$2</a>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br/>');
}
