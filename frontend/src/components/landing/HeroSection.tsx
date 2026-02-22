'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, Variants } from 'framer-motion';
import { api } from '@/lib/api';
import type { Repo } from '@/lib/types';
import { Canvas } from '@react-three/fiber';
import DroidCore3D from './DroidCore3D';

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
    <section className="relative flex min-h-[100dvh] items-center px-6 pt-20 overflow-hidden">
      <motion.div 
        className="z-10 flex w-full max-w-2xl flex-col gap-8"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: 0.15 },
          },
        }}
      >
        <motion.div variants={staggerVariants} className="flex flex-col gap-4">
          <h1 className="font-sans text-5xl font-semibold tracking-tighter text-pure-white md:text-7xl">
            Forge <span className="text-safety-orange">.</span>
          </h1>
          <p className="max-w-[45ch] font-sans text-lg leading-relaxed text-steel">
            Turn any repository into an interactive learning storyboard.
            Understand codebases step-by-step with AI-powered explanations,
            visual diagrams, and contextual chat.
          </p>
        </motion.div>

        <motion.div variants={staggerVariants} className="flex flex-col gap-2">
          <div className="relative flex items-center">
            <div className="absolute left-4 font-mono text-steel">
              {'>'}
            </div>
            <input
              type="text"
              placeholder={placeholder + (loading ? '' : '|')}
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleIngest()}
              disabled={loading}
              className="w-full bg-obsidian border border-[#313150] p-4 pl-10 font-mono text-sm text-pure-white outline-none transition-colors focus:border-safety-orange placeholder:text-steel"
            />
          </div>
          
          <motion.button
            onClick={handleIngest}
            disabled={loading || !gitUrl.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full bg-pure-white py-3 font-sans font-semibold text-obsidian transition-colors hover:bg-safety-orange hover:text-pure-white hover:drop-shadow-[0_0_12px_rgba(255,77,0,0.5)] disabled:opacity-50 disabled:hover:scale-100 disabled:hover:drop-shadow-none md:w-auto md:self-start md:px-8"
          >
            {loading ? 'PROCESSING...' : 'INITIALIZE'}
          </motion.button>
        </motion.div>

        {error && (
          <motion.div variants={staggerVariants} className="font-mono text-sm text-safety-orange drop-shadow-[0_0_8px_rgba(255,77,0,0.5)]">
            [ERR] {error}
          </motion.div>
        )}

        {status && (
          <motion.div variants={staggerVariants} className="flex flex-col gap-2 border border-[#313150] bg-[#0A0A0A] p-4">
            <div className="flex items-center justify-between font-mono text-xs text-steel">
              <span>{status.toUpperCase()}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 w-full bg-obsidian">
              <div
                className="h-full bg-safety-orange transition-all duration-300 drop-shadow-[0_0_8px_rgba(255,77,0,0.8)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </motion.div>
        )}
      </motion.div>

      <motion.div 
        className="pointer-events-none absolute right-0 top-0 h-full w-full opacity-30 md:w-1/2 md:opacity-100"
        animate={{ y: [0, -15, 0] }}
        transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
      >
        <Canvas camera={{ position: [0, 0, 8] }}>
          <DroidCore3D />
        </Canvas>
      </motion.div>
    </section>
  );
}
