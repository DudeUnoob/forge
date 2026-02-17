'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Repo } from '@/lib/types';
import './workspace.css';

const STORYBOARD_POLL_INTERVAL_MS = 3000;
const STORYBOARD_POLL_TIMEOUT_MS = 6 * 60 * 1000;

export default function LandingPage() {
  const router = useRouter();
  const [gitUrl, setGitUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waitForStoryboard = async (repoId: string): Promise<string> => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < STORYBOARD_POLL_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, STORYBOARD_POLL_INTERVAL_MS));

      let repo: Repo;
      try {
        repo = await api.repos.get(repoId);
      } catch {
        continue;
      }

      if (repo.storyboardId) {
        return repo.storyboardId;
      }

      if (repo.storyboardErrorMessage) {
        throw new Error(`Storyboard generation failed: ${repo.storyboardErrorMessage}`);
      }

      if (repo.status === 'ERROR') {
        throw new Error(repo.errorMessage || 'Storyboard generation failed');
      }

      if (repo.status === 'GENERATING_STORYBOARD') {
        setStatus('Generating storyboard blocks...');
      } else {
        setStatus('Finalizing storyboard...');
      }

      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(1, elapsed / STORYBOARD_POLL_TIMEOUT_MS);
      setProgress(70 + Math.round(ratio * 25));
    }

    throw new Error('Storyboard generation is taking longer than expected. Please retry in a moment.');
  };

  const handleIngest = async () => {
    if (!gitUrl.trim()) return;

    setLoading(true);
    setError(null);
    setStatus('Cloning repository...');
    setProgress(10);

    try {
      // Step 1: Ingest (or reuse an exact cached build if available)
      const ingestResult = await api.repos.ingest(gitUrl.trim());
      const { repoId } = ingestResult;
      let storyboardId = ingestResult.storyboardId || null;

      if (ingestResult.cached && ingestResult.status === 'PARSED' && storyboardId) {
        setStatus('Cached build found. Launching workspace...');
        setProgress(100);
        setTimeout(() => {
          router.push(`/workspace/${repoId}?storyboard=${storyboardId}`);
        }, 300);
        return;
      }

      // Step 2: Parse (skip if already parsed)
      if (ingestResult.status !== 'PARSED') {
        setStatus('Repository cloned. Parsing modules...');
        setProgress(35);
        await api.repos.parse(repoId);
      }

      // Step 3: Generate storyboard (skip if one already exists on cached repo)
      if (!storyboardId) {
        setStatus('Modules parsed. Generating storyboard...');
        setProgress(65);
        const generated = await api.storyboard.generate(repoId);
        storyboardId = generated.storyboardId || null;

        if (!storyboardId) {
          setStatus('Storyboard request accepted. Waiting for generation to finish...');
          setProgress(70);
          storyboardId = await waitForStoryboard(repoId);
        }
      }

      setStatus('Storyboard ready! Launching workspace...');
      setProgress(100);

      // Navigate to workspace
      setTimeout(() => {
        router.push(storyboardId
          ? `/workspace/${repoId}?storyboard=${storyboardId}`
          : `/workspace/${repoId}`);
      }, 500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
      setStatus(null);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing">
      <div className="landing-content">
        <div className="landing-logo">🔥</div>
        <h1 className="landing-title">Forge</h1>
        <p className="landing-subtitle">
          Turn any repository into an interactive learning storyboard.
          Understand codebases step-by-step with AI-powered explanations,
          visual diagrams, and contextual chat.
        </p>

        <div className="landing-input-group">
          <input
            type="text"
            placeholder="Paste a Git URL (e.g., https://github.com/expressjs/express)"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleIngest()}
            disabled={loading}
          />
          <button
            className="btn-primary"
            onClick={handleIngest}
            disabled={loading || !gitUrl.trim()}
          >
            {loading ? '⏳ Processing...' : '🚀 Forge It'}
          </button>
        </div>

        {error && (
          <div style={{ color: 'var(--error)', fontSize: '13px', marginTop: '8px' }}>
            ⚠️ {error}
          </div>
        )}

        {status && (
          <div className="landing-status">
            <div className="landing-status-text">{status}</div>
            <div className="landing-progress">
              <div
                className="landing-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="landing-features">
          <div className="landing-feature">
            <div className="landing-feature-icon">🧱</div>
            <div className="landing-feature-title">Lego Blocks</div>
            <div className="landing-feature-desc">
              Your codebase decomposed into ordered learning modules
            </div>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon">💬</div>
            <div className="landing-feature-title">Scoped AI Chat</div>
            <div className="landing-feature-desc">
              Ask questions grounded in the current module&apos;s context
            </div>
          </div>
          <div className="landing-feature">
            <div className="landing-feature-icon">🗺️</div>
            <div className="landing-feature-title">Role Paths</div>
            <div className="landing-feature-desc">
              Frontend, backend, or infra — see what matters to you first
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
