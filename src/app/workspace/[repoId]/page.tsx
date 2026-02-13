'use client';

import { useState, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Repo, FileNode, Storyboard, StoryboardBlock, ChatMessage, Role } from '@/lib/types';
import { ROLES } from '@/lib/types';
import '../../workspace.css';

type IconName =
    | 'files'
    | 'search'
    | 'storyboard'
    | 'settings'
    | 'account'
    | 'chat'
    | 'chevron-right'
    | 'chevron-down'
    | 'folder'
    | 'folder-open'
    | 'close'
    | 'warning'
    | 'command'
    | 'spark'
    | 'vscode';

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

    // ---- Open a file ----
    const openFile = useCallback(async (path: string) => {
        const existing = openFiles.findIndex(f => f.path === path);
        if (existing >= 0) {
            setActiveFileIndex(existing);
            return;
        }

        try {
            const data = await api.repos.fileContent(repoId, path);
            setOpenFiles(prev => {
                const next = [...prev, { path, content: data.content }];
                setActiveFileIndex(next.length - 1);
                return next;
            });
        } catch (err) {
            console.error('Failed to open file:', err);
            setErrors(prev => [...prev, `Could not open ${path}`]);
        }
    }, [repoId, openFiles]);

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
            openFile(block.keyFiles[0]);
        }
    }, [openFile]);

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
                        <AppIcon name="vscode" />
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
                    <AppIcon name="files" />
                </div>
                <div
                    className={`activity-bar-icon ${sidebarView === 'search' && !sidebarCollapsed ? 'active' : ''}`}
                    onClick={() => { setSidebarView('search'); setSidebarCollapsed(false); }}
                    title="Search"
                >
                    <AppIcon name="search" />
                </div>
                <div
                    className={`activity-bar-icon ${sidebarView === 'storyboard' && !sidebarCollapsed ? 'active' : ''}`}
                    onClick={() => { setSidebarView('storyboard'); setSidebarCollapsed(false); }}
                    title="Storyboard Blocks"
                >
                    <AppIcon name="storyboard" />
                    {totalBlocks > 0 && (
                        <span className="badge-count">{totalBlocks}</span>
                    )}
                </div>
                <div className="activity-bar-spacer" />
                <div
                    className="activity-bar-icon"
                    onClick={() => setShowCommandPalette(true)}
                    title="Command Palette (⌘K)"
                >
                    <AppIcon name="command" />
                </div>
                <div className="activity-bar-icon" title="Account">
                    <AppIcon name="account" />
                </div>
                <div className="activity-bar-icon" title="Settings">
                    <AppIcon name="settings" />
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
                                    <AppIcon name="command" />
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
                                    filter={treeFilter}
                                    activeFilePath={activeFile?.path}
                                />
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><AppIcon name="folder" /></div>
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
                                <div className="empty-state-icon"><AppIcon name="search" /></div>
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
                                <span className="error-banner-icon"><AppIcon name="warning" /></span>
                                <span className="error-banner-text">{err}</span>
                                <button className="error-banner-dismiss" onClick={() => dismissError(i)}>
                                    <AppIcon name="close" />
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
                                <FileIcon name={getFileName(file.path)} className="tab-icon" />
                                <span>{getFileName(file.path)}</span>
                                <span
                                    className="editor-tab-close"
                                    onClick={(e) => { e.stopPropagation(); closeFile(i); }}
                                >
                                    <AppIcon name="close" />
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
                                        <AppIcon name="chevron-right" />
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
                            <div className="editor-welcome-logo"><AppIcon name="vscode" /></div>
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
                        <AppIcon name="storyboard" />
                        Storyboard
                    </div>
                    <div
                        className={`panel-tab ${rightTab === 'chat' ? 'active' : ''}`}
                        onClick={() => setRightTab('chat')}
                    >
                        <AppIcon name="chat" />
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
                    <div className="statusbar-item"><AppIcon name="spark" /> Forge</div>
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
                    onOpenFile={(path: string) => { openFile(path); setShowCommandPalette(false); }}
                />
            )}
        </div>
    );
}

// =============== Sub-Components ===============

// ---- File Tree ----
function FileTreeNode({ node, onFileClick, depth = 0, filter = '', activeFilePath }: {
    node: FileNode;
    onFileClick: (path: string) => void;
    depth?: number;
    filter?: string;
    activeFilePath?: string;
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
            >
                <FileIcon name={node.name} className="tree-file-icon" />
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
                <span className="icon tree-chevron">{expanded ? <AppIcon name="chevron-down" /> : <AppIcon name="chevron-right" />}</span>
                <span className="icon tree-folder">{expanded ? <AppIcon name="folder-open" /> : <AppIcon name="folder" />}</span>
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
                                depth={depth + 1}
                                filter={filter}
                                activeFilePath={activeFilePath}
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
                <div className="empty-state-icon"><AppIcon name="storyboard" /></div>
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
function StoryboardPanel({ blocks, activeBlock, completedBlocks, role, onSelectBlock, onToggleComplete, onOpenFile }: {
    blocks: StoryboardBlock[];
    activeBlock: StoryboardBlock | null;
    completedBlocks: Set<string>;
    role: Role;
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
                                    <FileIcon name={getFileName(f)} className="inline-file-icon" /> {f}
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
                <div className="empty-state-icon"><AppIcon name="storyboard" /></div>
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
                                <AppIcon name="chevron-right" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ---- Command Palette ----
function CommandPalette({ onClose, onToggleSidebar, onSwitchRole, fileTree, onOpenFile }: {
    onClose: () => void;
    onToggleSidebar: () => void;
    onSwitchRole: (role: Role) => void;
    fileTree: FileNode | null;
    onOpenFile: (path: string) => void;
}) {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const commands: { icon: ReactNode; label: string; shortcut: string; action: () => void }[] = [
        { icon: <AppIcon name="files" />, label: 'Toggle Sidebar', shortcut: '⌘B', action: () => { onToggleSidebar(); onClose(); } },
        { icon: <AppIcon name="spark" />, label: 'Switch to Full Stack', shortcut: '', action: () => { onSwitchRole('fullstack'); onClose(); } },
        { icon: <AppIcon name="spark" />, label: 'Switch to Frontend', shortcut: '', action: () => { onSwitchRole('frontend'); onClose(); } },
        { icon: <AppIcon name="spark" />, label: 'Switch to Backend', shortcut: '', action: () => { onSwitchRole('backend'); onClose(); } },
        { icon: <AppIcon name="spark" />, label: 'Switch to Infra', shortcut: '', action: () => { onSwitchRole('infra'); onClose(); } },
    ];

    // Add open file commands from file tree
    const fileCommands = getFileList(fileTree).slice(0, 20).map(path => ({
        icon: <FileIcon name={getFileName(path)} className="command-file-icon" />,
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

function AppIcon({ name, className = '' }: { name: IconName; className?: string }) {
    const common = { className: `app-icon ${className}`.trim(), viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 };

    switch (name) {
        case 'files':
            return (
                <svg {...common}>
                    <path d="M2 3.5h5l1 1.5h6v7.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5Z" />
                    <path d="M2 6h12" />
                </svg>
            );
        case 'search':
            return (
                <svg {...common}>
                    <circle cx="7" cy="7" r="4.5" />
                    <path d="m10.5 10.5 3 3" />
                </svg>
            );
        case 'storyboard':
            return (
                <svg {...common}>
                    <rect x="2" y="2" width="5" height="5" />
                    <rect x="9" y="2" width="5" height="5" />
                    <rect x="2" y="9" width="5" height="5" />
                    <rect x="9" y="9" width="5" height="5" />
                </svg>
            );
        case 'settings':
            return (
                <svg {...common}>
                    <circle cx="8" cy="8" r="2.5" />
                    <path d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4" />
                </svg>
            );
        case 'account':
            return (
                <svg {...common}>
                    <circle cx="8" cy="5" r="2.5" />
                    <path d="M3 13c0-2.1 2.2-3.6 5-3.6s5 1.5 5 3.6" />
                </svg>
            );
        case 'chat':
            return (
                <svg {...common}>
                    <path d="M2.5 3.5h11v7h-5l-3 2.5v-2.5h-3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Z" />
                </svg>
            );
        case 'chevron-right':
            return (
                <svg {...common}>
                    <path d="m6 3 4 5-4 5" />
                </svg>
            );
        case 'chevron-down':
            return (
                <svg {...common}>
                    <path d="m3 6 5 4 5-4" />
                </svg>
            );
        case 'folder':
            return (
                <svg {...common}>
                    <path d="M1.8 4.5h4l1.4 1.7h7v5.9a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4.5Z" />
                </svg>
            );
        case 'folder-open':
            return (
                <svg {...common}>
                    <path d="M2 5.2h4l1 1.4h7l-1.7 5.7a1 1 0 0 1-1 .7H2.7a1 1 0 0 1-1-1l.3-6.8Z" />
                </svg>
            );
        case 'close':
            return (
                <svg {...common}>
                    <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
            );
        case 'warning':
            return (
                <svg {...common}>
                    <path d="M8 2.3 14 13H2L8 2.3Z" />
                    <path d="M8 6.2v3.5M8 11.7h.01" />
                </svg>
            );
        case 'command':
            return (
                <svg {...common}>
                    <rect x="2.2" y="2.2" width="4.3" height="4.3" rx="1.3" />
                    <rect x="9.5" y="2.2" width="4.3" height="4.3" rx="1.3" />
                    <rect x="2.2" y="9.5" width="4.3" height="4.3" rx="1.3" />
                    <rect x="9.5" y="9.5" width="4.3" height="4.3" rx="1.3" />
                </svg>
            );
        case 'spark':
            return (
                <svg {...common}>
                    <path d="m8 2 1.3 3.1L12.5 6l-3.2 1 .8 3.3L8 8.6l-2.1 1.7.8-3.3L3.5 6l3.2-.9L8 2Z" />
                </svg>
            );
        case 'vscode':
            return (
                <svg {...common}>
                    <path d="M11.3 2.4 6.2 6.9l-2-1.5L2.6 6.8l1.7 1.4-1.7 1.4L4.2 11l2-1.5 5.1 4.1 2.1-1V3.4l-2.1-1Z" />
                </svg>
            );
        default:
            return null;
    }
}

function FileIcon({ name, className = '' }: { name: string; className?: string }) {
    const iconMeta = getFileIconMeta(name);
    const style = {
        '--file-icon-color': iconMeta.color,
        '--file-icon-bg': iconMeta.background,
    } as CSSProperties;

    return (
        <span className={`file-icon ${className}`.trim()} style={style}>
            {iconMeta.label}
        </span>
    );
}

function getFileIconMeta(name: string): { label: string; color: string; background: string } {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, { label: string; color: string; background: string }> = {
        ts: { label: 'TS', color: '#3178c6', background: 'rgba(49, 120, 198, 0.2)' },
        tsx: { label: 'TX', color: '#4fc1ff', background: 'rgba(79, 193, 255, 0.2)' },
        js: { label: 'JS', color: '#d7ba7d', background: 'rgba(215, 186, 125, 0.2)' },
        jsx: { label: 'JX', color: '#d7ba7d', background: 'rgba(215, 186, 125, 0.2)' },
        css: { label: 'CS', color: '#42a5f5', background: 'rgba(66, 165, 245, 0.2)' },
        scss: { label: 'SC', color: '#c586c0', background: 'rgba(197, 134, 192, 0.2)' },
        html: { label: 'HT', color: '#e37933', background: 'rgba(227, 121, 51, 0.2)' },
        json: { label: '{}', color: '#cbcb41', background: 'rgba(203, 203, 65, 0.2)' },
        md: { label: 'MD', color: '#519aba', background: 'rgba(81, 154, 186, 0.2)' },
        yml: { label: 'YM', color: '#f44747', background: 'rgba(244, 71, 71, 0.2)' },
        yaml: { label: 'YM', color: '#f44747', background: 'rgba(244, 71, 71, 0.2)' },
        py: { label: 'PY', color: '#4b8bbe', background: 'rgba(75, 139, 190, 0.2)' },
        go: { label: 'GO', color: '#00add8', background: 'rgba(0, 173, 216, 0.2)' },
        rs: { label: 'RS', color: '#ce9178', background: 'rgba(206, 145, 120, 0.2)' },
        java: { label: 'JV', color: '#b07219', background: 'rgba(176, 114, 25, 0.2)' },
        sh: { label: 'SH', color: '#89d185', background: 'rgba(137, 209, 133, 0.2)' },
        lock: { label: 'LK', color: '#808080', background: 'rgba(128, 128, 128, 0.2)' },
        svg: { label: 'SV', color: '#e3a832', background: 'rgba(227, 168, 50, 0.2)' },
        txt: { label: 'TX', color: '#9da5b4', background: 'rgba(157, 165, 180, 0.2)' },
    };
    return map[ext] || { label: 'FI', color: '#9da5b4', background: 'rgba(157, 165, 180, 0.2)' };
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
