'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, Variants } from 'framer-motion';
import { api } from '@/lib/api';
import type { Repo } from '@/lib/types';
import AgentNetworkVisualizer from './AgentNetworkVisualizer';

const STORYBOARD_POLL_INTERVAL_MS = 3000;
const STORYBOARD_POLL_TIMEOUT_MS = 6 * 60 * 1000;
const PARSE_POLL_INTERVAL_MS = 3000;
const PARSE_POLL_TIMEOUT_MS = 6 * 60 * 1000;
const INGEST_POLL_INTERVAL_MS = 3000;
const INGEST_POLL_TIMEOUT_MS = 8 * 60 * 1000;

const PLACEHOLDERS = [
  "Paste a Git URL (e.g., https://github.com/expressjs/express)",
  "Generate a storyboard for React Native",
  "Initialize agentic codebase parsing",
  "Parse Django backend architecture"
];

const staggerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 20 } },
};

export default function HeroSection() {
  const router = useRouter();
  const [gitUrl, setGitUrl] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [placeholder, setPlaceholder] = useState('');
  const [phIndex, setPhIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (loading) return;

    const currentString = PLACEHOLDERS[phIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && charIndex === currentString.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && charIndex === 0) {
      setIsDeleting(false);
      setPhIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    } else {
      timeout = setTimeout(() => {
        setCharIndex((prev) => prev + (isDeleting ? -1 : 1));
      }, isDeleting ? 30 : 70);
    }

    setPlaceholder(currentString.substring(0, charIndex));
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, phIndex, loading]);

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

  const waitForParse = async (repoId: string): Promise<void> => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < PARSE_POLL_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, PARSE_POLL_INTERVAL_MS));

      let repo: Repo;
      try {
        repo = await api.repos.get(repoId);
      } catch {
        continue;
      }

      if (repo.status === 'PARSED') {
        return;
      }

      if (repo.status === 'ERROR') {
        throw new Error(repo.errorMessage || 'Repository parsing failed');
      }

      if (repo.status === 'PARSING') {
        setStatus('Parsing repository modules...');
      } else {
        setStatus('Waiting for parse to finish...');
      }

      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(1, elapsed / PARSE_POLL_TIMEOUT_MS);
      setProgress(40 + Math.round(ratio * 20));
    }

    throw new Error('Repository parsing is taking longer than expected. Please retry in a moment.');
  };

  const waitForIngest = async (repoId: string): Promise<Repo> => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < INGEST_POLL_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, INGEST_POLL_INTERVAL_MS));

      let repo: Repo;
      try {
        repo = await api.repos.get(repoId);
      } catch {
        continue;
      }

      if (repo.status === 'UPLOADED' || repo.status === 'PARSED') {
        return repo;
      }

      if (repo.status === 'ERROR') {
        throw new Error(repo.errorMessage || 'Repository ingest failed');
      }

      if (repo.status === 'CLONING') {
        setStatus('Cloning repository and uploading files...');
      } else {
        setStatus('Preparing repository...');
      }

      const elapsed = Date.now() - startedAt;
      const ratio = Math.min(1, elapsed / INGEST_POLL_TIMEOUT_MS);
      setProgress(15 + Math.round(ratio * 15));
    }

    throw new Error('Repository ingest is taking longer than expected. Please retry in a moment.');
  };

  const handleIngest = async () => {
    if (!gitUrl.trim()) return;

    setLoading(true);
    setError(null);
    setStatus('Cloning repository...');
    setProgress(10);

    try {
      const ingestResult = await api.repos.ingest(gitUrl.trim());
      const { repoId } = ingestResult;
      let storyboardId = ingestResult.storyboardId || null;
      let repoStatus = ingestResult.status;

      if (ingestResult.cached && ingestResult.status === 'PARSED' && storyboardId) {
        setStatus('Cached build found. Launching workspace...');
        setProgress(100);
        setTimeout(() => {
          router.push(`/workspace/${repoId}?storyboard=${storyboardId}`);
        }, 300);
        return;
      }

      if (repoStatus === 'CLONING') {
        setStatus('Ingest request accepted. Waiting for repository upload...');
        setProgress(15);
        const ingestedRepo = await waitForIngest(repoId);
        repoStatus = ingestedRepo.status;
        storyboardId = storyboardId || ingestedRepo.storyboardId || null;
      }

      if (repoStatus !== 'PARSED') {
        setStatus('Repository cloned. Parsing modules...');
        setProgress(35);
        const parseResult = await api.repos.parse(repoId);

        if (parseResult.status !== 'PARSED') {
          setStatus('Parse request accepted. Waiting for parse to finish...');
          setProgress(40);
          await waitForParse(repoId);
        }
      }

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
    <section className="relative flex min-h-[100dvh] w-full flex-col px-6 pt-32 pb-12 overflow-hidden md:justify-center lg:pt-0">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-8 relative z-10 items-start">

        {/* Left Column Text & CTAs */}
        <motion.div
          className="z-10 flex w-full flex-col lg:pt-[15vh]"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.15 },
            },
          }}
        >
          {/* Top Label */}
          <motion.div variants={staggerVariants} className="mb-6 flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-safety-orange shadow-[0_0_8px_rgba(255,77,0,0.6)]" />
            <span className="font-mono text-[10px] sm:text-xs font-medium tracking-[0.2em] text-steel">
              VISION
            </span>
          </motion.div>

          <motion.div variants={staggerVariants} className="flex flex-col gap-6">
            <h1 className="text-pure-white font-sans font-normal text-[40px] leading-[100%] tracking-[-0.16rem] lg:tracking-[-0.18rem] lg:-ml-1 lg:text-6xl 2xl:text-7xl">
              Forge<span className="text-safety-orange">.</span>
            </h1>

            <div className="flex flex-col gap-y-4 lg:max-w-[600px] lg:gap-y-6">
              <p className="font-mono text-[16px] leading-[120%] tracking-[-0.02rem] lg:text-[18px] lg:tracking-[-0.0225rem] text-steel text-balance">
                Turn any repository into an interactive learning storyboard.
              </p>
              <p className="font-mono text-[16px] leading-[120%] tracking-[-0.02rem] lg:text-[18px] lg:tracking-[-0.0225rem] text-steel text-balance">
                Understand codebases step-by-step with AI-powered explanations,
                visual diagrams, and contextual chat.
              </p>
            </div>
          </motion.div>

          {/* Terminal Input Element */}
          <motion.div variants={staggerVariants} className="mt-10 sm:mt-12 w-full max-w-[540px]">
            <div className="flex flex-col overflow-hidden rounded-xl border border-[#313150]/60 bg-[#0A0A0A]/40 backdrop-blur-md">
              <div className="flex items-center gap-4 border-b border-[#313150]/60 px-4 py-2.5 text-[9px] sm:text-[10px] font-mono tracking-widest text-steel bg-[#050505]/80">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="rounded border border-[#313150]/80 bg-[#111111]/80 px-2 sm:px-3 py-1 text-pure-white shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                    WEB / BROWSER
                  </span>
                  <span className="px-2 py-1 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
                    CLI / API
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 p-4 sm:p-5 lg:p-6 bg-[#000000]/60">
                <div className="relative flex items-center">
                  <div className="absolute left-0 font-mono text-safety-orange">{'>'}</div>
                  <input
                    type="text"
                    placeholder={placeholder + (loading ? '' : '|')}
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleIngest()}
                    disabled={loading}
                    className="w-full bg-transparent pl-6 font-mono text-xs sm:text-sm text-pure-white outline-none placeholder:text-steel/60 transition-colors"
                  />
                </div>
              </div>
            </div>

            <motion.button
              onClick={handleIngest}
              disabled={loading || !gitUrl.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-3 w-full bg-pure-white py-3.5 sm:py-4 font-sans text-[11px] sm:text-xs font-bold tracking-[0.15em] text-obsidian transition-colors uppercase hover:bg-safety-orange hover:text-pure-white disabled:opacity-50"
            >
              {loading ? 'PROCESSING...' : 'INITIALIZE'}
            </motion.button>
          </motion.div>

          {error && (
            <motion.div variants={staggerVariants} className="mt-4 font-mono text-sm text-safety-orange drop-shadow-[0_0_8px_rgba(255,77,0,0.5)]">
              [ERR] {error}
            </motion.div>
          )}

          {status && (
            <motion.div variants={staggerVariants} className="mt-4 flex max-w-[540px] flex-col gap-2 border border-[#313150] bg-[#0A0A0A] p-4 rounded-xl">
              <div className="flex items-center justify-between font-mono text-[10px] text-steel tracking-widest uppercase">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 w-full bg-obsidian rounded-full overflow-hidden">
                <div
                  className="h-full bg-safety-orange transition-all duration-300 shadow-[0_0_8px_rgba(255,77,0,0.8)] rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </motion.div>
          )}

          {/* Bottom Trusted By block to balance the layout like factory.ai */}
          <motion.div variants={staggerVariants} className="mt-16 sm:mt-24 flex items-center gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-safety-orange" />
            <span className="font-mono text-[9px] tracking-widest text-steel uppercase">Platform Integrations</span>
          </motion.div>
          <motion.div variants={staggerVariants} className="mt-4 flex items-center gap-8 opacity-40 grayscale pointer-events-none">
            <span className="font-sans text-sm font-bold text-steel">GitHub</span>
            <span className="font-sans text-sm font-bold text-steel">GitLab</span>
            <span className="font-sans text-sm font-bold text-steel">Bitbucket</span>
          </motion.div>
        </motion.div>

        {/* Right Column Visualizer */}
        <div className="pointer-events-none relative w-full h-[300px] sm:h-[450px] lg:h-[700px] flex items-center justify-center lg:justify-end xl:-mx-8 opacity-90 pt-[6vh]">
          <AgentNetworkVisualizer />
        </div>
      </div>
    </section>
  );
}
