'use client';

import { useState, useEffect, useCallback, useId, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Repo, FileNode, Storyboard, StoryboardBlock, ChatMessage, Role } from '@/lib/types';
import { ROLES } from '@/lib/types';
import '../../../workspace.css';

// ---- Syntax Highlighting ----
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import py from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import md from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('typescript', ts);
SyntaxHighlighter.registerLanguage('typescriptreact', ts);
SyntaxHighlighter.registerLanguage('javascript', js);
SyntaxHighlighter.registerLanguage('javascriptreact', js);
SyntaxHighlighter.registerLanguage('python', py);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('markdown', md);
SyntaxHighlighter.registerLanguage('sql', sql);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('yaml', yaml);

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
    languageIds?: Record<string, string>;
    iconDefinitions?: Record<string, SetiIconDefinition>;
}

interface SearchMatch {
    line: number;
    lineContent: string;
}

interface SearchResult {
    file: FileNode; // or just path/name
    path: string;
    matches: SearchMatch[];
}



interface MermaidRenderResult {
    svg: string;
}

interface MermaidApi {
    initialize: (config: Record<string, unknown>) => void;
    render: (id: string, diagram: string) => Promise<MermaidRenderResult>;
    parse: (diagram: string) => Promise<unknown>;
}

declare global {
    interface Window {
        mermaid?: MermaidApi;
        __forgeMermaidLoader?: Promise<MermaidApi>;
        __forgeMermaidInitialized?: boolean;
    }
}

const SETI_THEME_URL = '/fonts/vs-seti-icon-theme.json';
const MERMAID_CDN_URL = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
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
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [activeSnippetContext, setActiveSnippetContext] = useState<{ snippet: string; lang: string; filePath: string } | null>(null);
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

    // Progressive reveal state
    const [revealedFiles, setRevealedFiles] = useState<Set<string>>(new Set());
    const [showAllFiles, setShowAllFiles] = useState(false);
    const [newlyRevealedFiles, setNewlyRevealedFiles] = useState<Set<string>>(new Set());
    const newFilesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Building intro state

    const [showIntro, setShowIntro] = useState(true);

    // Resize state
    const [sidebarWidth, setSidebarWidth] = useState(282);
    const [panelWidth, setPanelWidth] = useState(376);
    const [isResizing, setIsResizing] = useState<'sidebar' | 'panel' | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [contactSearch, setContactSearch] = useState(false); // trigger for debounce

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

    // ---- Resize Handlers ----
    const startResizing = useCallback((type: 'sidebar' | 'panel') => {
        setIsResizing(type);
    }, []);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (isResizing === 'sidebar') {
                const newWidth = Math.max(160, Math.min(600, e.clientX - 48)); // 48 is activity bar
                setSidebarWidth(newWidth);
            } else {
                const newWidth = Math.max(200, Math.min(800, window.innerWidth - e.clientX));
                setPanelWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // ---- Search Logic (Client-Side) ----
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(() => {
            if (!fileTree) return;
            const query = searchQuery.toLowerCase();
            const results: SearchResult[] = [];

            // Helper to walk tree
            const walk = (node: FileNode) => {
                if (node.type === 'file' && node.path) {
                    let matches: SearchMatch[] = [];
                    let matchedFile = false;

                    // 1. Check filename
                    if (node.name.toLowerCase().includes(query)) {
                        matchedFile = true;
                    }

                    // 2. Check content if cached
                    const content = fileContentCacheRef.current.get(node.path);
                    if (content) {
                        const lines = content.split('\n');
                        lines.forEach((line, i) => {
                            if (line.toLowerCase().includes(query)) {
                                matches.push({ line: i + 1, lineContent: line });
                            }
                        });
                    }

                    if (matchedFile || matches.length > 0) {
                        results.push({
                            file: node,
                            path: node.path,
                            matches
                        });
                    }
                } else if (node.children) {
                    node.children.forEach(walk);
                }
            };

            walk(fileTree);
            setSearchResults(results.slice(0, 100)); // Limit results
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, fileTree]);


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
        setActiveSnippetContext(null);

        // Progressive reveal: add this block's keyFiles to the revealed set
        if (block.keyFiles?.length > 0) {
            setRevealedFiles(prev => {
                const next = new Set(prev);
                const freshFiles = new Set<string>();
                for (const f of block.keyFiles) {
                    if (!next.has(f)) {
                        next.add(f);
                        freshFiles.add(f);
                    }
                }
                // Track newly revealed files for subtle animation
                if (freshFiles.size > 0) {
                    setNewlyRevealedFiles(freshFiles);
                    if (newFilesTimerRef.current) clearTimeout(newFilesTimerRef.current);
                    newFilesTimerRef.current = setTimeout(() => setNewlyRevealedFiles(new Set()), 1800);
                }
                return next;
            });
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
        if (!chatInput.trim() || !storyboardId || !activeBlock) return;

        // Optionally attach the snippet block context visually and in API
        let apiContent = chatInput.trim();
        const snippetToAttach = activeSnippetContext;

        if (snippetToAttach) {
            // Implicit syntax block sent to AI
            apiContent = `[Context from file: ${snippetToAttach.filePath}]\n\`\`\`${snippetToAttach.lang}\n${snippetToAttach.snippet}\n\`\`\`\n\n${apiContent}`;
        }

        const userMsg: ChatMessage = {
            role: 'user',
            content: chatInput.trim(),
            contextSnippet: snippetToAttach || undefined
        };

        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setActiveSnippetContext(null);
        setChatLoading(true);

        try {
            const { response } = await api.chat.send(storyboardId, activeBlock.blockId, apiContent);
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
    }, [chatInput, storyboardId, activeBlock, activeSnippetContext]);

    // ---- Dismiss error ----
    const dismissError = useCallback((index: number) => {
        setErrors(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleAskAboutSnippet = useCallback((snippet: string, lang: string, filePath: string) => {
        // Ensure a block is active so the chat is visible
        if (!activeBlock && visibleBlocks.length > 0) {
            activateBlock(visibleBlocks[0]);
        }

        // Set the snippet context after activating the block so it is not cleared
        setActiveSnippetContext({ snippet, lang, filePath });
        setTimeout(() => {
            const chatInputEl = document.querySelector('.chat-input') as HTMLInputElement | null;
            if (chatInputEl) {
                chatInputEl.focus();
            }
        }, 50);
    }, [activeBlock, visibleBlocks, activateBlock]);

    // Ctrl/Cmd + J → Ask about selected snippet
    useEffect(() => {
        const handleCtrlJ = (e: KeyboardEvent) => {
            if (!((e.metaKey || e.ctrlKey) && e.key === 'j')) return;

            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) return;
            const text = selection.toString().trim();
            if (!text) return;

            const codeViewer = document.querySelector('.code-viewer');
            if (!codeViewer || !codeViewer.contains(selection.anchorNode) || !codeViewer.contains(selection.focusNode)) return;

            e.preventDefault();

            const file = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;
            if (!file) return;

            const lang = getLanguageFromPath(file.path);
            handleAskAboutSnippet(text, lang, file.path);
            selection.removeAllRanges();
        };
        window.addEventListener('keydown', handleCtrlJ);
        return () => window.removeEventListener('keydown', handleCtrlJ);
    }, [handleAskAboutSnippet, openFiles, activeFileIndex]);

    if (loading) {
        return (
            <div className="loading-spinner" style={{ height: '100vh' }}>
                <div className="spinner" />
            </div>
        );
    }

    // Auto-dismiss intro after a brief delay
    if (showIntro && storyboard && storyboard.blocks.length > 0) {
        setTimeout(() => setShowIntro(false), 2200);
    } else if (showIntro) {
        // No storyboard — skip intro
        setTimeout(() => setShowIntro(false), 0);
    }

    const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

    return (
        <div
            className={`workspace ${isResizing ? 'resizing' : ''}`}
            style={{
                gridTemplateColumns: `48px ${sidebarCollapsed ? '0px' : `${sidebarWidth}px`} 5px minmax(0, 1fr) 5px ${panelWidth}px`
            }}
        >
            {/* ---- Building Intro Overlay ---- */}
            {showIntro && storyboard && (
                <div className="building-intro">
                    <div className="building-intro-content">
                        <div className="building-intro-icon">
                            <Codicon name="code" />
                        </div>
                        <div className="building-intro-title">Building {repo?.name || 'Repository'}</div>
                        <div className="building-intro-subtitle">
                            {storyboard.blocks.length} blocks to explore
                        </div>
                        <div className="building-intro-bricks">
                            {storyboard.blocks.slice(0, 12).map((block, i) => (
                                <div
                                    key={block.blockId}
                                    className="building-intro-brick"
                                    style={{ animationDelay: `${i * 120}ms` }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

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
                    onClick={() => {
                        if (sidebarView === 'explorer' && !sidebarCollapsed) {
                            setSidebarCollapsed(true);
                        } else {
                            setSidebarView('explorer');
                            setSidebarCollapsed(false);
                        }
                    }}
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
                                <button
                                    className={`icon-btn ${showAllFiles ? 'icon-btn--active' : ''}`}
                                    onClick={() => setShowAllFiles(v => !v)}
                                    title={showAllFiles ? 'Show progressive reveal' : 'Show all files'}
                                >
                                    <Codicon name={showAllFiles ? 'eye' : 'eye-closed'} />
                                </button>
                                <button className="icon-btn">
                                    <Codicon name="ellipsis" />
                                </button>
                            </div>
                        </div>
                        {!showAllFiles && storyboard && revealedFiles.size > 0 && (
                            <div className="progressive-hint">
                                <Codicon name="layers" />
                                <span>{revealedFiles.size} files revealed · Block {Math.max(1, activeBlockIndex + 1)}/{totalBlocks}</span>
                            </div>
                        )}
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
                                    node={showAllFiles ? fileTree : filterTreeByPaths(fileTree, revealedFiles)}
                                    onFileClick={openFile}
                                    onFileHover={prefetchFile}
                                    filter={treeFilter}
                                    activeFilePath={activeFile?.path}
                                    setiTheme={setiTheme}
                                    newFiles={newlyRevealedFiles}
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
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="sidebar-content">
                            {searchResults.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><Codicon name="search" /></div>
                                    <div className="empty-state-text">
                                        {searchQuery ? 'No results found' : 'Type to search files and cached content'}
                                    </div>
                                </div>
                            ) : (
                                <div className="search-results">
                                    <div className="search-options" style={{ justifyContent: 'space-between', padding: '0 12px 8px' }}>
                                        <div className="search-match-count" style={{ padding: 0 }}>
                                            {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
                                        </div>
                                    </div>
                                    {searchResults.map((res) => (
                                        <div key={res.path} className="search-file-group">
                                            <div
                                                className="search-file-header"
                                                onClick={() => openFile(res.path)}
                                            >
                                                <div className="icon">
                                                    <Codicon name="chevron-down" />
                                                </div>
                                                <SetiIcon theme={setiTheme} kind="file" name={res.file.name} className="inline-file-icon" />
                                                <span className="name" title={res.path}>{res.file.name}</span>
                                                <span className="search-file-count">{res.matches.length > 0 ? res.matches.length : 1}</span>
                                            </div>
                                            {res.matches.map((match, idx) => (
                                                <div
                                                    key={`${res.path}-${idx}`}
                                                    className="search-match-item"
                                                    onClick={() => openFile(res.path)}
                                                >
                                                    <span className="search-match-line-num">{match.line}</span>
                                                    <span className="search-match-text">{match.lineContent.trim().substring(0, 60)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
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

            {/* Resize Handle (Sidebar) */}
            <div
                className={`resize-handle ${isResizing === 'sidebar' ? 'active' : ''}`}
                onMouseDown={() => startResizing('sidebar')}
            />

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
                            onAskAboutSnippet={handleAskAboutSnippet}
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

            {/* Resize Handle (Right Panel) */}
            <div
                className={`resize-handle ${isResizing === 'panel' ? 'active' : ''}`}
                onMouseDown={() => startResizing('panel')}
            />

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
                        activeSnippetContext={activeSnippetContext}
                        onClearSnippetContext={() => setActiveSnippetContext(null)}
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
function FileTreeNode({ node, onFileClick, onFileHover, depth = 0, filter = '', activeFilePath, setiTheme, newFiles }: {
    node: FileNode;
    onFileClick: (path: string) => void;
    onFileHover?: (path: string) => void;
    depth?: number;
    filter?: string;
    activeFilePath?: string;
    setiTheme?: SetiIconTheme | null;
    newFiles?: Set<string>;
}) {
    const [expanded, setExpanded] = useState(depth < 2);

    // Auto-expand directories that contain newly revealed files
    const hasNewDescendant = useMemo(() => {
        if (!newFiles || newFiles.size === 0 || node.type === 'file') return false;
        const checkNew = (n: FileNode): boolean => {
            if (n.type === 'file' && n.path && newFiles.has(n.path)) return true;
            return n.children?.some(c => checkNew(c)) || false;
        };
        return checkNew(node);
    }, [newFiles, node]);

    useEffect(() => {
        if (hasNewDescendant && !expanded) {
            setExpanded(true);
        }
    }, [hasNewDescendant]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const isNew = node.path ? newFiles?.has(node.path) : false;
        return (
            <div
                className={`file-tree-item ${isActive ? 'active' : ''} ${isNew ? 'file-tree-item--new' : ''}`}
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
        <div className={`file-tree-dir ${hasNewDescendant ? 'file-tree-dir--new' : ''}`}>
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
                                newFiles={newFiles}
                            />
                        ))}
                </div>
            )}
        </div>
    );
}

// ---- Code Viewer with Syntax Highlighting ----
function CodeViewer({ content, filePath, highlightedLines, onAskAboutSnippet }: {
    content: string;
    filePath: string;
    highlightedLines: Set<number>;
    onAskAboutSnippet?: (snippet: string, lang: string, filePath: string) => void;
}) {
    const lines = content.split('\n');
    const lang = getLanguageFromPath(filePath);

    const [selectionContext, setSelectionContext] = useState<{ text: string; top: number; left: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (!selection || selection.isCollapsed) {
                setSelectionContext(null);
                return;
            }

            const text = selection.toString().trim();
            if (!text) {
                setSelectionContext(null);
                return;
            }

            if (containerRef.current && containerRef.current.contains(selection.anchorNode)) {
                const range = selection.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                const containerRect = containerRef.current.getBoundingClientRect();

                setSelectionContext({
                    text,
                    top: rect.top - containerRect.top - 40,
                    left: rect.left - containerRect.left + (rect.width / 2),
                });
            } else {
                setSelectionContext(null);
            }
        };

        document.addEventListener('selectionchange', handleSelection);
        return () => document.removeEventListener('selectionchange', handleSelection);
    }, []);

    return (
        <div className="code-viewer" ref={containerRef} style={{ position: 'relative' }}>
            {selectionContext && onAskAboutSnippet && (
                <button
                    className="ask-snippet-tooltip"
                    style={{
                        top: Math.max(0, selectionContext.top),
                        left: selectionContext.left,
                        transform: 'translateX(-50%)'
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onClick={() => {
                        onAskAboutSnippet(selectionContext.text, lang, filePath);
                        setSelectionContext(null);
                        window.getSelection()?.removeAllRanges();
                    }}
                >
                    <Codicon name="comment-discussion" style={{ marginRight: 6 }} /> Ask about this snippet <span style={{ opacity: 0.5, marginLeft: 4, fontSize: 10 }}>⌘J</span>
                </button>
            )}
            <SyntaxHighlighter
                language={getLanguageFromPath(filePath)}
                style={vscDarkPlus}
                customStyle={{ margin: 0, padding: '10px 0', background: 'transparent', border: 'none', borderRadius: 0, boxShadow: 'none', fontSize: '13px', lineHeight: '1.5' }}
                showLineNumbers={true}
                lineNumberStyle={{ minWidth: '3.5em', paddingRight: '1em', color: '#6e7681', textAlign: 'right' }}
                wrapLines={true}
                lineProps={(lineNumber) => ({
                    style: {
                        display: 'block',
                        backgroundColor: highlightedLines.has(lineNumber) ? 'rgba(255, 255, 0, 0.1)' : undefined
                    }
                })}
            >
                {content}
            </SyntaxHighlighter>
        </div>
    );
}

function sanitizeMermaid(raw: string): string {
    let s = raw.trim();
    // Strip markdown code fences
    s = s.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```\s*$/g, '');
    // Remove %%{init:...}%% config directives
    s = s.replace(/%%\{init:[\s\S]*?\}%%/g, '');
    // Remove HTML tags from node labels
    s = s.replace(/<[^>]+>/g, '');
    // Wrap unquoted labels that contain special chars in double quotes
    // Matches node definitions like A[label with spaces] or A(label)
    s = s.replace(/(\w+)\[([^\]"]+)\]/g, (_m, id, label) => {
        if (/[^a-zA-Z0-9_]/.test(label)) return `${id}["${label}"]`;
        return `${id}[${label}]`;
    });
    s = s.replace(/(\w+)\(([^)"]+)\)/g, (_m, id, label) => {
        if (/[^a-zA-Z0-9_]/.test(label)) return `${id}("${label}")`;
        return `${id}(${label})`;
    });
    // Normalize line endings
    s = s.replace(/\r\n/g, '\n');
    return s.trim();
}

function MermaidDiagram({ diagram, compact = false }: { diagram: string; compact?: boolean }) {
    const source = typeof diagram === 'string' ? sanitizeMermaid(diagram) : '';
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

                // Pre-validate to avoid mermaid injecting error SVGs into the DOM
                try {
                    await mermaid.parse(source);
                } catch {
                    if (cancelled) return;
                    setRenderError('Diagram has syntax errors');
                    setSvg('');
                    return;
                }

                const result = await mermaid.render(instanceIdRef.current, source);
                if (cancelled) return;
                setSvg(result.svg || '');
                setRenderError(null);
            } catch (err) {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : 'Could not render diagram';
                setRenderError(message);
                setSvg('');
                // Clean up any error elements mermaid may have injected
                const errorEl = document.getElementById(`d${instanceIdRef.current}`);
                if (errorEl) errorEl.remove();
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
    activeSnippetContext,
    onClearSnippetContext,
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
    activeSnippetContext?: { snippet: string; lang: string; filePath: string } | null;
    onClearSnippetContext?: () => void;
    onToggleComplete: (blockId: string) => void;
    onOpenFile: (path: string) => void;
    onChatInputChange: (value: string) => void;
    onSendChat: () => void;
    onGoPrev: () => void;
    onGoNext: () => void;
}) {

    const scrollableRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        scrollableRef.current?.scrollTo(0, 0);
    }, [activeBlock]);
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
            {/* ── Sticky Header: Progress Only ── */}
            <div className="block-detail-sticky-header">
                <div className="block-navigation">
                    <div className="block-nav-status">
                        Step {Math.max(1, activeBlockIndex + 1)} of {blocks.length}
                    </div>
                </div>
                <div className="block-progress-bar">
                    <div className="block-progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="block-progress-label">{completedCount} of {blocks.length} completed</div>
            </div>

            {/* ── Scrollable Content ── */}
            <div className="block-detail-scrollable" ref={scrollableRef}>
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
                                    <span dangerouslySetInnerHTML={{ __html: simpleMarkdown(takeaway) }} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="block-detail-section block-chat-section">
                    <div className="block-detail-section-title">Chat About This Block</div>
                    <ChatPanel
                        messages={chatMessages}
                        input={chatInput}
                        loading={chatLoading}
                        activeBlock={currentBlock}
                        onInputChange={onChatInputChange}
                        onSend={onSendChat}
                        activeSnippetContext={activeSnippetContext}
                        onClearSnippetContext={onClearSnippetContext}
                        embedded
                    />
                </div>
            </div>

            {/* ── Sticky Footer: Smart Navigation ── */}
            <div className="block-detail-sticky-footer">
                <div className="footer-actions">
                    <button
                        className="btn-secondary footer-btn-compact"
                        onClick={onGoPrev}
                        disabled={!canGoPrev}
                    >
                        ← Previous
                    </button>

                    {!currentBlockComplete ? (
                        <button
                            className="btn-primary footer-btn-primary"
                            onClick={() => onToggleComplete(currentBlock.blockId)}
                        >
                            ✓ Mark as Complete
                        </button>
                    ) : (
                        canGoNext ? (
                            <button
                                className="btn-primary footer-btn-primary"
                                onClick={onGoNext}
                            >
                                Continue to Next Block →
                            </button>
                        ) : (
                            <button
                                className="btn-secondary footer-btn-primary"
                                disabled
                                style={{ opacity: 0.7 }}
                            >
                                ✓ All Steps Completed
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}


// ---- Chat Panel ----
function ChatPanel({
    messages,
    input,
    loading,
    activeBlock,
    onInputChange,
    onSend,
    activeSnippetContext,
    onClearSnippetContext,
    embedded = false
}: {
    messages: ChatMessage[];
    input: string;
    loading: boolean;
    activeBlock: StoryboardBlock | null;
    onInputChange: (value: string) => void;
    onSend: () => void;
    activeSnippetContext?: { snippet: string; lang: string; filePath: string } | null;
    onClearSnippetContext?: () => void;
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
                                    {msg.role === 'user' && msg.contextSnippet && (
                                        <div className="chat-message-context-pill">
                                            <Codicon name="list-selection" />
                                            <span>Attached Code: {getFileName(msg.contextSnippet.filePath || 'snippet')}</span>
                                        </div>
                                    )}
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
                        {activeSnippetContext && (
                            <div className="chat-snippet-attachment">
                                <div className="attachment-content">
                                    <Codicon name="file-code" />
                                    <span className="attachment-filename">{getFileName(activeSnippetContext.filePath)}</span>
                                </div>
                                <div className="attachment-preview">
                                    {activeSnippetContext.snippet.split('\n')[0].substring(0, 35)}...
                                </div>
                                <button className="attachment-clear-btn" onClick={onClearSnippetContext}>
                                    <Codicon name="close" />
                                </button>
                            </div>
                        )}
                        <div className="chat-input-wrapper">
                            <input
                                className="chat-input"
                                type="text"
                                placeholder={activeSnippetContext ? "Ask about this code..." : "Ask about this block..."}
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
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

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

    const visibleItems = filtered.slice(0, 15);

    // Reset selection when query changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Clamp selectedIndex when visibleItems length changes (e.g. fileTree update while palette is open)
    useEffect(() => {
        setSelectedIndex(prev => (visibleItems.length === 0 ? 0 : Math.min(prev, visibleItems.length - 1)));
    }, [visibleItems.length]);

    // Auto-scroll the selected item into view
    useEffect(() => {
        if (!resultsRef.current) return;
        const items = resultsRef.current.querySelectorAll('.command-palette-item');
        if (items[selectedIndex]) {
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            onClose();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (visibleItems.length > 0) {
                setSelectedIndex(prev => Math.min(prev + 1, visibleItems.length - 1));
            }
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (visibleItems.length > 0) {
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            }
            return;
        }
        if (e.key === 'Enter') {
            const item = visibleItems[selectedIndex];
            if (item) {
                item.action();
                onClose();
            }
        }
    };

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
                        onKeyDown={handleKeyDown}
                        role="combobox"
                        aria-expanded={visibleItems.length > 0}
                        aria-controls="command-palette-listbox"
                        aria-activedescendant={visibleItems.length > 0 ? `command-palette-option-${selectedIndex}` : undefined}
                    />
                </div>
                <div
                        id="command-palette-listbox"
                        className="command-palette-results"
                        ref={resultsRef}
                        role="listbox"
                    >
                    {visibleItems.map((cmd, i) => (
                        <div
                            key={i}
                            id={`command-palette-option-${i}`}
                            role="option"
                            aria-selected={i === selectedIndex}
                            className={`command-palette-item ${i === selectedIndex ? 'selected' : ''}`}
                            onClick={cmd.action}
                            onMouseEnter={() => setSelectedIndex(i)}
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
    const iconMeta = resolveSetiIcon(theme, kind, name);

    if (iconMeta?.glyph) {
        const style = iconMeta.color ? ({ color: iconMeta.color } as CSSProperties) : undefined;
        return (
            <span className={`seti-icon ${className}`.trim()} style={style}>
                {iconMeta.glyph}
            </span>
        );
    }

    // Fallback: codicon icons with VS Code-like folder colors
    if (kind === 'folder' || kind === 'folderExpanded') {
        const folderColors: Record<string, string> = {
            'node_modules': '#73d291',
            'src': '#dcb67a',
            '.git': '#f38ba8',
            'public': '#b49efc',
            '.next': '#5ea1ff',
            'dist': '#94a3b8',
            'build': '#94a3b8',
            'test': '#4ade80',
            'tests': '#4ade80',
            '__tests__': '#4ade80',
            'lib': '#dcb67a',
            'config': '#94a3b8',
            'components': '#67e8f9',
            'pages': '#c084fc',
            'app': '#fb923c',
            'api': '#22d3ee',
            'hooks': '#f472b6',
            'utils': '#a78bfa',
            'styles': '#38bdf8',
            'assets': '#fbbf24',
        };
        const color = folderColors[name.toLowerCase()] || '#c5c5c5';
        return (
            <span className={`codicon-icon ${className}`.trim()} style={{ color }}>
                <Codicon name={kind === 'folderExpanded' ? 'folder-opened' : 'folder'} />
            </span>
        );
    }

    return <Codicon name="file" className={className} />;
}

// resolveSetiIcon, resolveSetiFileIconId, resolveSetiFolderIconId handle all icon resolution

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
    // 1. Exact file name match (highest priority)
    const exactMatch = theme.fileNames?.[lowerName];
    if (exactMatch) return exactMatch;

    // 2. File extension match (compound extensions tried longest-first)
    const parts = lowerName.split('.');
    if (parts.length > 1) {
        for (let i = 1; i < parts.length; i += 1) {
            const ext = parts.slice(i).join('.');
            const byExtension = theme.fileExtensions?.[ext];
            if (byExtension) return byExtension;
        }
    }

    // 3. Language ID fallback — maps file extension to VS Code language ID
    if (theme.languageIds && parts.length > 1) {
        const ext = parts[parts.length - 1];
        const langId = EXT_TO_LANGUAGE_ID[ext];
        if (langId) {
            const byLang = theme.languageIds[langId];
            if (byLang) return byLang;
        }
    }

    return theme.file || '';
}

// Maps common file extensions to VS Code language identifiers
// Used to resolve icons through the seti theme's languageIds map
const EXT_TO_LANGUAGE_ID: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact',
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascriptreact',
    py: 'python', pyw: 'python',
    css: 'css', scss: 'scss', sass: 'sass', less: 'less', styl: 'stylus',
    html: 'html', htm: 'html',
    json: 'json', jsonc: 'jsonc', jsonl: 'jsonl',
    md: 'markdown', mdx: 'markdown',
    yaml: 'yaml', yml: 'yaml',
    xml: 'xml', xsl: 'xml', xsd: 'xml', svg: 'xml',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin', kts: 'kotlin',
    rb: 'ruby', erb: 'erb',
    c: 'c', h: 'c',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
    cs: 'csharp',
    swift: 'swift',
    dart: 'dart',
    r: 'r', R: 'r',
    lua: 'lua',
    sh: 'shellscript', bash: 'shellscript', zsh: 'shellscript',
    ps1: 'powershell', psm1: 'powershell',
    sql: 'sql',
    php: 'php',
    pl: 'perl', pm: 'perl',
    ex: 'elixir', exs: 'elixir',
    elm: 'elm',
    hs: 'haskell', lhs: 'haskell',
    clj: 'clojure', cljs: 'clojure', cljc: 'clojure',
    coffee: 'coffeescript',
    bat: 'bat', cmd: 'bat',
    fs: 'fsharp', fsx: 'fsharp',
    ml: 'ocaml', mli: 'ocaml',
    groovy: 'groovy',
    vue: 'vue',
    tf: 'terraform',
    tex: 'tex', latex: 'latex',
    m: 'objective-c', mm: 'objective-cpp',
    makefile: 'makefile',
    dockerfile: 'dockerfile',
    haml: 'haml',
    pug: 'jade', jade: 'jade',
    hbs: 'handlebars', handlebars: 'handlebars',
    mustache: 'mustache',
    njk: 'nunjucks', nunjucks: 'nunjucks',
    jinja: 'jinja', j2: 'jinja',
    vala: 'vala',
    env: 'dotenv',
};

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
    // Seti JSON stores as "\\E001" → parsed JSON yields "\E001"
    // Strip leading backslash(es) and any non-hex prefix
    const hex = fontCharacter.replace(/^\\+/, '').replace(/[^0-9a-fA-F]/g, '');
    if (!hex) return '';
    const codepoint = Number.parseInt(hex, 16);
    if (Number.isNaN(codepoint) || codepoint === 0) return '';
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

/** Filter a FileNode tree to only include files whose paths are in the given set */
function filterTreeByPaths(node: FileNode, paths: Set<string>): FileNode {
    if (paths.size === 0) return { ...node, children: [] };

    if (node.type === 'file') {
        return node; // caller should only pass nodes that match
    }

    const filteredChildren: FileNode[] = [];
    for (const child of (node.children || [])) {
        if (child.type === 'file') {
            if (child.path && paths.has(child.path)) {
                filteredChildren.push(child);
            }
        } else {
            // Directory: recurse and keep only if it has matching descendants
            const filtered = filterTreeByPaths(child, paths);
            if (filtered.children && filtered.children.length > 0) {
                filteredChildren.push(filtered);
            }
        }
    }

    return { ...node, children: filteredChildren };
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

/** Markdown-to-HTML supporting code blocks, lists, blockquotes, headings, inline styles, links */
function simpleMarkdown(src: string): string {
    const codeBlocks: string[] = [];

    // 1. Extract fenced code blocks before any escaping
    let text = src.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
        const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const placeholder = `%%CODEBLOCK_${codeBlocks.length}%%`;
        codeBlocks.push(`<pre><code class="language-${lang || 'text'}">${escaped}</code></pre>`);
        return placeholder;
    });

    // 2. Escape HTML in remaining text
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 3. Links (before other inline transforms)
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
    text = text.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer noopener">$2</a>');

    // 4. Headings
    text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 5. Inline styles
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 6. Blockquotes (consecutive > lines grouped)
    text = text.replace(/(^&gt; .+(?:\n&gt; .+)*)/gm, (match) => {
        const inner = match.replace(/^&gt; /gm, '');
        return `<blockquote>${inner}</blockquote>`;
    });

    // 7. Lists — process line-by-line to group consecutive list items
    const lines = text.split('\n');
    const result: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    for (let i = 0; i < lines.length; i++) {
        const ulMatch = lines[i].match(/^(\s*)[-*]\s+(.+)$/);
        const olMatch = lines[i].match(/^(\s*)\d+\.\s+(.+)$/);

        if (ulMatch) {
            if (listType !== 'ul') {
                if (listType) result.push(`</${listType}>`);
                result.push('<ul>');
                listType = 'ul';
            }
            result.push(`<li>${ulMatch[2]}</li>`);
        } else if (olMatch) {
            if (listType !== 'ol') {
                if (listType) result.push(`</${listType}>`);
                result.push('<ol>');
                listType = 'ol';
            }
            result.push(`<li>${olMatch[2]}</li>`);
        } else {
            if (listType) {
                result.push(`</${listType}>`);
                listType = null;
            }
            result.push(lines[i]);
        }
    }
    if (listType) result.push(`</${listType}>`);

    text = result.join('\n');

    // 8. Line breaks for remaining plain lines (but not inside block elements)
    text = text.replace(/\n/g, '<br/>');
    // Clean up extra breaks around block elements
    text = text.replace(/<br\/>(<\/?(?:ul|ol|li|blockquote|h[1-3]|pre)>)/g, '$1');
    text = text.replace(/(<\/?(?:ul|ol|li|blockquote|h[1-3]|pre)>)<br\/>/g, '$1');

    // 9. Restore code blocks
    codeBlocks.forEach((block, i) => {
        text = text.replace(`%%CODEBLOCK_${i}%%`, block);
    });

    return text;
}
