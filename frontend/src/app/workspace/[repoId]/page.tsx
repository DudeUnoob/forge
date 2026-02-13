'use client';

import { useState, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
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

const SETI_THEME_URL = 'https://cdn.jsdelivr.net/gh/microsoft/vscode@main/extensions/theme-seti/icons/vs-seti-icon-theme.json';
const FILE_CONTENT_CACHE_LIMIT = 80;
const PREFETCH_BATCH_SIZE = 20;
const PREFETCH_TREE_SAMPLE_SIZE = 16;
const PREFETCH_BLOCK_SAMPLE_SIZE = 12;

// =============== Main Workspace Component ===============

export default function WorkspacePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const repoId = params.repoId as string;
    const storyboardId = searchParams.get('storyboard');

    // Core state
    const [repo, setRepo] = useState<Repo | null>(null);
    const [fileTree, setFileTree] = useState<FileNode | null>(null);
    const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
    const [activeBlock, setActiveBlock] = useState<StoryboardBlock | null>(null);
    const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set());

    // Editor state
    const [openFiles, setOpenFiles] = useState<{ path: string; content: string }[]>([]);
    const [activeFileIndex, setActiveFileIndex] = useState<number>(-1);
    const [highlightedLines, setHighlightedLines] = useState<Set<number>>(new Set());

    // Panel state
    const [rightTab, setRightTab] = useState<'storyboard' | 'chat'>('storyboard');
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
    const fileContentCacheRef = useRef<Map<string, string>>(new Map());
    const inFlightFileRequestsRef = useRef<Map<string, Promise<string>>>(new Map());
    const prefetchedPathsRef = useRef<Set<string>>(new Set());

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
    }, [repoId]);

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

    // ---- Fetch data on mount ----
    useEffect(() => {
        async function load() {
            const loadErrors: string[] = [];

            try {
                const repoData = await api.repos.get(repoId);
                setRepo(repoData);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to load repo';
                loadErrors.push(`Repo: ${msg}`);
                console.error('Repo load error:', err);
            }

            try {
                const filesData = await api.repos.files(repoId);
                setFileTree(filesData.tree);
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to load files';
                loadErrors.push(`Files: ${msg}`);
                console.error('Files load error:', err);
            }

            if (storyboardId) {
                try {
                    const sb = await api.storyboard.get(storyboardId);
                    setStoryboard(sb);
                    if (sb.blocks.length > 0) {
                        setActiveBlock(sb.blocks[0]);
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Failed to load storyboard';
                    loadErrors.push(`Storyboard: ${msg}`);
                    console.error('Storyboard load error:', err);
                }
            }

            if (loadErrors.length > 0) setErrors(loadErrors);
            setLoading(false);
        }
        load();
    }, [repoId, storyboardId]);

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

    // ---- Toggle block completion ----
    const toggleBlockComplete = useCallback((blockId: string) => {
        setCompletedBlocks(prev => {
            const next = new Set(prev);
            if (next.has(blockId)) next.delete(blockId);
            else next.add(blockId);
            return next;
        });
        api.progress.completeBlock('anonymous', repoId, blockId).catch(console.error);
    }, [repoId]);

    // ---- Send chat message ----
    const sendChat = useCallback(async () => {
        if (!chatInput.trim() || !storyboardId || !activeBlock) return;

        const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setChatLoading(true);

        try {
            const { response } = await api.chat.send(storyboardId, activeBlock.blockId, userMsg.content);
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
    }, [chatInput, storyboardId, activeBlock]);

    // ---- Select block ----
    const selectBlock = useCallback((block: StoryboardBlock) => {
        setActiveBlock(block);
        setChatMessages([]);
        setHighlightedLines(new Set());
        if (block.keyFiles?.length > 0) {
            void prefetchFiles(block.keyFiles.slice(0, PREFETCH_BLOCK_SAMPLE_SIZE));
            openFile(block.keyFiles[0]);
        }
    }, [openFile, prefetchFiles]);

    // ---- Dismiss error ----
    const dismissError = useCallback((index: number) => {
        setErrors(prev => prev.filter((_, i) => i !== index));
    }, []);

    // ---- Compute progress ----
    const totalBlocks = storyboard?.blocks.length || 0;
    const completedCount = completedBlocks.size;
    const progressPercent = totalBlocks > 0 ? (completedCount / totalBlocks) * 100 : 0;

    if (loading) {
        return (
            <div className="loading-spinner" style={{ height: '100vh' }}>
                <div className="spinner" />
            </div>
        );
    }

    const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

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
                                blocks={storyboard?.blocks || []}
                                activeBlock={activeBlock}
                                completedBlocks={completedBlocks}
                                role={role}
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
                <div className="panel-tabs">
                    <div
                        className={`panel-tab ${rightTab === 'storyboard' ? 'active' : ''}`}
                        onClick={() => setRightTab('storyboard')}
                    >
                        <Codicon name="symbol-structure" />
                        Storyboard
                    </div>
                    <div
                        className={`panel-tab ${rightTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setRightTab('chat')}
                    >
                        <Codicon name="comment-discussion" />
                        Chat
                    </div>
                </div>

                <div className="panel-content">
                    {rightTab === 'storyboard' ? (
                        <StoryboardPanel
                            blocks={storyboard?.blocks || []}
                            activeBlock={activeBlock}
                            completedBlocks={completedBlocks}
                            role={role}
                            setiTheme={setiTheme}
                            onSelectBlock={selectBlock}
                            onToggleComplete={toggleBlockComplete}
                            onOpenFile={openFile}
                        />
                    ) : (
                        <ChatPanel
                            messages={chatMessages}
                            input={chatInput}
                            loading={chatLoading}
                            activeBlock={activeBlock}
                            onInputChange={setChatInput}
                            onSend={sendChat}
                        />
                    )}
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

// ---- Mini Block List for sidebar ----
function MiniBlockList({ blocks, activeBlock, completedBlocks, role, onSelectBlock }: {
    blocks: StoryboardBlock[];
    activeBlock: StoryboardBlock | null;
    completedBlocks: Set<string>;
    role: Role;
    onSelectBlock: (block: StoryboardBlock) => void;
}) {
    const filtered = blocks.filter(b => role === 'fullstack' || b.roleTags?.includes(role));

    if (filtered.length === 0) {
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
            {filtered.map(block => (
                <div
                    key={block.blockId}
                    className={`block-item ${activeBlock?.blockId === block.blockId ? 'active' : ''} ${completedBlocks.has(block.blockId) ? 'completed' : ''}`}
                    onClick={() => onSelectBlock(block)}
                    style={{ padding: '6px 8px' }}
                >
                    <div className="block-check" style={{ width: 16, height: 16, fontSize: 9 }}>
                        {completedBlocks.has(block.blockId) && '✓'}
                    </div>
                    <div className="block-info">
                        <div className="block-title" style={{ fontSize: 12 }}>{block.title}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ---- Storyboard Panel ----
function StoryboardPanel({ blocks, activeBlock, completedBlocks, role, setiTheme, onSelectBlock, onToggleComplete, onOpenFile }: {
    blocks: StoryboardBlock[];
    activeBlock: StoryboardBlock | null;
    completedBlocks: Set<string>;
    role: Role;
    setiTheme: SetiIconTheme | null;
    onSelectBlock: (block: StoryboardBlock) => void;
    onToggleComplete: (blockId: string) => void;
    onOpenFile: (path: string) => void;
}) {
    // Show block detail if one is active
    if (activeBlock && blocks.find(b => b.blockId === activeBlock.blockId)) {
        return (
            <div className="block-detail animate-fade-in">
                <button
                    className="btn-ghost"
                    onClick={() => onSelectBlock(blocks[0])}
                    style={{ marginBottom: 12 }}
                >
                    ← Back to blocks
                </button>

                <div className="block-detail-header">
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        {activeBlock.roleTags?.map(tag => (
                            <span key={tag} className={`badge badge-${tag}`}>{tag}</span>
                        ))}
                        <span className="block-time">~{activeBlock.estimatedMinutes} min</span>
                    </div>
                    <div className="block-detail-title">{activeBlock.title}</div>
                    <div className="block-detail-objective">{activeBlock.objective}</div>
                </div>

                {/* Explanation */}
                <div className="block-detail-section">
                    <div className="block-detail-section-title">Explanation</div>
                    <div className="markdown-content">
                        <div dangerouslySetInnerHTML={{ __html: simpleMarkdown(activeBlock.explanationMarkdown || '') }} />
                    </div>
                </div>

                {/* Mermaid Diagram */}
                {activeBlock.mermaidDiagram && (
                    <div className="block-detail-section">
                        <div className="block-detail-section-title">Diagram</div>
                        <div className="mermaid-container">
                            <pre style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                {activeBlock.mermaidDiagram}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Key Files */}
                {activeBlock.keyFiles?.length > 0 && (
                    <div className="block-detail-section">
                        <div className="block-detail-section-title">Key Files</div>
                        <div className="block-files-list">
                            {activeBlock.keyFiles.map(f => (
                                <div key={f} className="block-file-link" onClick={() => onOpenFile(f)}>
                                    <SetiIcon theme={setiTheme} kind="file" name={getFileName(f)} className="inline-file-icon" /> {f}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Key Takeaways */}
                {activeBlock.keyTakeaways && activeBlock.keyTakeaways.length > 0 && (
                    <div className="block-detail-section">
                        <div className="block-detail-section-title">Key Takeaways</div>
                        <div className="takeaway-list">
                            {activeBlock.keyTakeaways.map((t, i) => (
                                <div key={i} className="takeaway-item">
                                    <span className="takeaway-icon">✓</span>
                                    <span>{t}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Mark Complete */}
                <button
                    className={completedBlocks.has(activeBlock.blockId) ? 'btn-secondary' : 'btn-primary'}
                    onClick={() => onToggleComplete(activeBlock.blockId)}
                    style={{ width: '100%', marginTop: 16 }}
                >
                    {completedBlocks.has(activeBlock.blockId) ? '↺ Mark Incomplete' : '✓ Mark as Complete'}
                </button>
            </div>
        );
    }

    // Empty state
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

    // Block list view
    return (
        <div className="block-list">
            {blocks
                .filter(b => role === 'fullstack' || b.roleTags?.includes(role))
                .map(block => (
                    <div
                        key={block.blockId}
                        className={`block-item ${activeBlock?.blockId === block.blockId ? 'active' : ''} ${completedBlocks.has(block.blockId) ? 'completed' : ''}`}
                        onClick={() => onSelectBlock(block)}
                    >
                        <div
                            className="block-check"
                            onClick={(e) => { e.stopPropagation(); onToggleComplete(block.blockId); }}
                        >
                            {completedBlocks.has(block.blockId) && '✓'}
                        </div>
                        <div className="block-info">
                            <div className="block-title">{block.title}</div>
                            <div className="block-objective">{block.objective}</div>
                            <div className="block-tags">
                                {block.roleTags?.map(tag => (
                                    <span key={tag} className={`badge badge-${tag}`}>{tag}</span>
                                ))}
                                <span className="block-time">~{block.estimatedMinutes}m</span>
                            </div>
                        </div>
                    </div>
                ))}
        </div>
    );
}

// ---- Chat Panel ----
function ChatPanel({ messages, input, loading, activeBlock, onInputChange, onSend }: {
    messages: ChatMessage[];
    input: string;
    loading: boolean;
    activeBlock: StoryboardBlock | null;
    onInputChange: (value: string) => void;
    onSend: () => void;
}) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="chat-container">
            {!activeBlock ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p>Select a storyboard block to start chatting about it.</p>
                </div>
            ) : (
                <>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--panel-border)', fontSize: 12, color: 'var(--text-muted)' }}>
                        Chatting about: <strong style={{ color: 'var(--accent)' }}>{activeBlock.title}</strong>
                    </div>

                    <div className="chat-messages">
                        {messages.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>
                                Ask anything about this block. Your questions will be answered using the block&apos;s source code and documentation as context.
                                {activeBlock.suggestedQuestions && activeBlock.suggestedQuestions.length > 0 && (
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Suggested questions:</div>
                                        {activeBlock.suggestedQuestions.map((q, i) => (
                                            <div
                                                key={i}
                                                style={{ cursor: 'pointer', color: 'var(--accent)', margin: '4px 0' }}
                                                onClick={() => onInputChange(q)}
                                            >
                                                → {q}
                                            </div>
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
                                        <div dangerouslySetInnerHTML={{ __html: simpleMarkdown(msg.content) }} />
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

function getFileName(path: string): string {
    return path.split('/').pop() || path;
}

function sortTreeNodes(a: FileNode, b: FileNode): number {
    if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function Codicon({ name, className = '' }: { name: string; className?: string }) {
    return <i className={`codicon codicon-${name} ${className}`.trim()} aria-hidden="true" />;
}

function SetiIcon({ theme, kind, name, className = '' }: {
    theme: SetiIconTheme | null | undefined;
    kind: 'file' | 'folder' | 'folderExpanded';
    name: string;
    className?: string;
}) {
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

/** Very simple markdown-to-HTML (bold, italic, code, headings, links) */
function simpleMarkdown(md: string): string {
    return md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br/>');
}
