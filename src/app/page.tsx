'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import './workspace.css';

export default function LandingPage() {
  const router = useRouter();
  const [gitUrl, setGitUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIngest = async () => {
    if (!gitUrl.trim()) return;

    setLoading(true);
    setError(null);
    setStatus('Cloning repository and preparing workspace...');
    setProgress(20);

    try {
      // Ingest first, then continue parse/storyboard generation in workspace.
      const ingestResult = await api.repos.ingest(gitUrl.trim());
      const { repoId, storyboardId } = ingestResult;

      setStatus(storyboardId
        ? 'Cached storyboard found. Launching workspace...'
        : 'Repository snapshot ready. Launching workspace...');
      setProgress(100);

      setTimeout(() => {
        router.push(storyboardId
          ? `/workspace/${repoId}?storyboard=${storyboardId}`
          : `/workspace/${repoId}`);
      }, 250);
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
