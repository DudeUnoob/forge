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
    <main className="flex-1 mt-[80px]">
      <div className="relative mx-auto grid h-auto w-full grid-cols-4 gap-x-4 lg:grid-cols-12 lg:gap-x-6 my-20 bg-transparent px-4 first:mt-4 lg:mt-20 lg:px-9 first:lg:mt-10 lg:mb-30 lg:h-[calc(100dvh-160px)] lg:max-h-[725px] lg:min-h-[620px] xl:mb-22">

        {/* Left Column (Text & Input) */}
        <motion.div
          className="z-10 col-span-4 flex max-w-[650px] flex-col justify-between lg:col-span-6 lg:max-w-none"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: { staggerChildren: 0.15 },
            },
          }}
        >
          <div className="flex flex-col gap-y-6 lg:gap-y-8">
            <motion.div variants={staggerVariants} className="text-pretty font-mono text-[15px] leading-[100%] tracking-[-0.0175rem] inline-flex items-center gap-3 pt-4 uppercase">
              <div className="size-2.5 transform-gpu rounded-full border bg-safety-orange border-transparent shadow-[0_0_8px_rgba(255,77,0,0.6)]"></div>
              <p className="whitespace-nowrap text-steel text-pretty font-mono text-[13px] leading-[100%] tracking-[-0.015rem] uppercase">Vision</p>
            </motion.div>

            <motion.h1
              variants={staggerVariants}
              className="font-normal text-[44px] leading-[100%] tracking-[-0.17rem] lg:tracking-[-0.20rem] lg:-ml-1.5 lg:text-[66px] 2xl:text-[80px]"
              style={{ color: '#EEEEEE' }}
              aria-label="Forge."
            >
              Forge<span className="text-safety-orange">.</span>
            </motion.h1>

            <motion.div variants={staggerVariants} className="flex flex-col gap-y-4 lg:max-w-[660px] lg:gap-y-6">
              <p className="font-mono text-[18px] leading-[120%] tracking-[-0.0225rem] lg:text-[20px] lg:tracking-[-0.025rem] text-steel text-balance">
                Turn any repository into an interactive learning storyboard.
              </p>
              <p className="font-mono text-[18px] leading-[120%] tracking-[-0.0225rem] lg:text-[20px] lg:tracking-[-0.025rem] text-steel text-balance">
                Understand codebases step-by-step with AI-powered explanations,
                visual diagrams, and contextual chat.
              </p>
            </motion.div>

            <motion.div variants={staggerVariants} className="max-w-[660px]">
              <div className="flex flex-col gap-y-2.5">
                <div className="border-neutral-800 bg-dark-base-primary rounded-lg border">
                  <div className="border-neutral-800 flex gap-3 border-b p-3.5">
                    <button type="button" className="cursor-pointer">
                      <span className="grid h-6 w-fit place-content-center rounded-sm border px-1.5 bg-dark-base-secondary border-neutral-800 text-[#E6E6E6]">
                        <p className="text-pure-white text-pretty font-mono text-[13px] leading-[100%] tracking-[-0.015rem] uppercase">WEB / BROWSER</p>
                      </span>
                    </button>
                    <button type="button" className="cursor-pointer">
                      <span className="grid h-6 w-fit place-content-center rounded-sm border px-1.5 border-transparent text-steel hover:text-[#E6E6E6] transition-colors duration-150">
                        <p className="text-pretty font-mono text-[13px] leading-[100%] tracking-[-0.015rem] uppercase">CLI / API</p>
                      </span>
                    </button>
                  </div>

                  <div className="px-3.5 py-5">
                    <div className="text-pure-white relative flex items-center gap-3 overflow-clip p-3.5 border-neutral-800 bg-[#000000] rounded-lg border">
                      <span className="text-pretty font-mono text-[15px] tracking-[-0.0175rem] lg:text-[18px] lg:tracking-[-0.02rem] flex-1 flex items-center overflow-x-auto leading-snug !normal-case [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden whitespace-nowrap">
                        <span className="text-safety-orange mr-2">&gt;</span>
                        <input
                          type="text"
                          placeholder={placeholder + (loading ? '' : '|')}
                          value={gitUrl}
                          onChange={(e) => setGitUrl(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleIngest()}
                          disabled={loading}
                          className="w-full bg-transparent font-mono outline-none placeholder:text-steel/60 transition-colors"
                        />
                      </span>

                      <button
                        onClick={handleIngest}
                        disabled={loading || !gitUrl.trim()}
                        className="group absolute transition-all duration-200 lg:p-2.5 opacity-100 -m-2 p-2 hover:bg-neutral-800/50 bg-dark-base-primary z-50 cursor-pointer top-4 right-3.5 rounded-md border border-neutral-800 flex items-center justify-center p-1"
                        aria-label="Initialize"
                      >
                        {loading ? (
                          <span className="font-mono text-[11px] text-steel">...</span>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256" className="transition-all duration-200 will-change-transform text-steel group-hover:text-pure-white">
                            <path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <motion.div variants={staggerVariants} className="mt-2 font-mono text-[15px] text-safety-orange drop-shadow-[0_0_8px_rgba(255,77,0,0.5)]">
                    [ERR] {error}
                  </motion.div>
                )}

                {status && (
                  <motion.div variants={staggerVariants} className="mt-2 flex flex-col gap-2 border border-neutral-800 bg-dark-base-primary p-4 rounded-xl">
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
              </div>
            </motion.div>
          </div>

          {/* Footer (Integrations) */}
          <div className="mt-auto pt-6 z-10 hidden lg:block">
            <section className="relative mx-auto grid h-auto w-full grid-cols-4 gap-x-4 lg:grid-cols-12 lg:gap-x-6 my-20 bg-transparent first:mt-4 first:lg:mt-10 px-0 lg:px-0 lg:mt-0 lg:mb-0 lg:items-center mt-0 mb-0">
              <div className="text-pretty font-mono text-[15px] leading-[100%] tracking-[-0.0175rem] inline-flex items-center uppercase gap-3 text-steel col-span-full mb-8 h-max lg:col-span-12 lg:mb-0 whitespace-nowrap">
                <div className="size-2.5 transform-gpu rounded-full border bg-safety-orange border-transparent"></div>
                <p className="whitespace-nowrap text-steel text-pretty font-mono text-[13px] leading-[100%] tracking-[-0.015rem] uppercase">
                  Platform Integrations
                </p>
              </div>

              <div className="relative col-span-full overflow-hidden lg:col-span-12 mt-4">
                <div className="relative flex w-fit transition-opacity duration-300 ease-in-out opacity-100 items-center justify-start gap-10 sm:gap-20 opacity-40 grayscale">
                  <div className="flex items-center justify-center font-sans text-[20px] sm:text-[22px] font-bold text-steel hover:text-pure-white transition-colors duration-250 w-fit h-6 lg:h-10">GitHub</div>
                  <div className="flex items-center justify-center font-sans text-[20px] sm:text-[22px] font-bold text-steel hover:text-pure-white transition-colors duration-250 w-fit h-6 lg:h-10">GitLab</div>
                  <div className="flex items-center justify-center font-sans text-[20px] sm:text-[22px] font-bold text-steel hover:text-pure-white transition-colors duration-250 w-fit h-6 lg:h-10">Bitbucket</div>
                </div>
              </div>
            </section>
          </div>

        </motion.div>

        {/* Right Column (Visualizer) */}
        <div className="pointer-events-none relative h-full w-full overflow-hidden md:pointer-events-auto mix-blend-lighten z-0 col-span-full aspect-[3/2] max-w-[770px] lg:absolute lg:top-[clamp(15px,8dvh,90px)] lg:-right-12 lg:aspect-[4/3] lg:max-h-[clamp(715px,55vw,1100px)] lg:w-[clamp(660px,59vw,1100px)] lg:max-w-none 2xl:-right-2">
          <div style={{ width: '100%', height: '100%' }}>
            <AgentNetworkVisualizer />
          </div>
        </div>

        {/* Footer (Integrations) - Mobile */}
        <div className="col-span-full mt-auto pt-6 z-10 lg:hidden">
          <section className="relative mx-auto grid h-auto w-full grid-cols-4 gap-x-4 lg:grid-cols-12 lg:gap-x-6 my-20 bg-transparent first:mt-4 first:lg:mt-10 px-0 lg:px-0 lg:mt-0 lg:mb-0 lg:items-center mt-0 mb-0">
            <div className="text-pretty font-mono text-[15px] leading-[100%] tracking-[-0.0175rem] inline-flex items-center uppercase gap-3 text-steel col-span-full mb-8 h-max lg:col-span-2 lg:mb-0 whitespace-nowrap">
              <div className="size-2.5 transform-gpu rounded-full border bg-safety-orange border-transparent"></div>
              <p className="whitespace-nowrap text-steel text-pretty font-mono text-[13px] leading-[100%] tracking-[-0.015rem] uppercase">
                Platform Integrations
              </p>
            </div>

            <div className="relative col-span-full overflow-hidden lg:col-span-8 lg:col-start-5 xl:col-span-6 xl:col-start-7">
              <div className="relative flex w-fit transition-opacity duration-300 ease-in-out opacity-100 items-center justify-start gap-10 sm:gap-20 opacity-40 grayscale">
                <div className="flex items-center justify-center font-sans text-[20px] sm:text-[22px] font-bold text-steel hover:text-pure-white transition-colors duration-250 w-fit h-6 lg:h-10">GitHub</div>
                <div className="flex items-center justify-center font-sans text-[20px] sm:text-[22px] font-bold text-steel hover:text-pure-white transition-colors duration-250 w-fit h-6 lg:h-10">GitLab</div>
                <div className="flex items-center justify-center font-sans text-[20px] sm:text-[22px] font-bold text-steel hover:text-pure-white transition-colors duration-250 w-fit h-6 lg:h-10">Bitbucket</div>
              </div>
            </div>
          </section>
        </div>

      </div>
    </main>
  );
}


