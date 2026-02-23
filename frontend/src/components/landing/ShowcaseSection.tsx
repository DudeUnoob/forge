'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretRight, TreeStructure, FileCode, ChatTeardropText } from '@phosphor-icons/react';

const FEATURES = [
  {
    id: 'storyboards',
    label: 'Interactive Storyboards',
    description: 'Navigate your codebase as a sequence of logical lego blocks, from foundational modules to advanced architecture.',
  },
  {
    id: 'ide',
    label: 'IDE-Native Explorer',
    description: 'Browse the repository just like you do locally. Storyboards link directly to source code and references.',
  },
  {
    id: 'chat',
    label: 'Contextual AI Chat',
    description: 'Ask questions scoped strictly to the current module and its dependencies to eliminate hallucinations.',
  },
  {
    id: 'roles',
    label: 'Role-Based Paths',
    description: 'Frontend, backend, or infra—see the parts of the codebase that matter most to your specific role.',
  }
];

const variants = {
  enter: (direction: number) => {
    return {
      y: direction > 0 ? 80 : -80,
      opacity: 0,
      scale: 0.95,
      filter: "blur(8px)"
    };
  },
  center: {
    zIndex: 1,
    y: 0,
    opacity: 1,
    scale: 1,
    filter: "blur(0px)"
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      y: direction < 0 ? 80 : -80,
      opacity: 0,
      scale: 0.95,
      filter: "blur(8px)"
    };
  }
};

export default function ShowcaseSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [[activeIdx, direction], setPage] = useState([0, 0]);
  const activeFeature = FEATURES[activeIdx];

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current;
    if (!section) return;

    const isDesktop = () => typeof window !== 'undefined' && window.innerWidth >= 768;

    if (!isDesktop()) {
      return;
    }

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: '+=300%',
      pin: true,
      anticipatePin: 1,
      snap: {
        snapTo: 1 / (FEATURES.length - 1),
        duration: 0.5,
        ease: "power4.inOut"
      },
      onUpdate: (self) => {
        const progress = self.progress;
        let idx = Math.floor(progress * FEATURES.length);
        if (idx >= FEATURES.length) idx = FEATURES.length - 1;
        setPage((prev) => {
          if (prev[0] !== idx) return [idx, idx > prev[0] ? 1 : -1];
          return prev;
        });
      }
    });

    const onResize = () => {
      if (!isDesktop()) {
        trigger?.kill();
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      trigger?.kill();
    };
  }, []);

  return (
    <section ref={sectionRef} id="features" className="pt-16 pb-20 px-5 sm:pt-20 sm:pb-24 sm:px-6 md:min-h-[100dvh] md:py-24 md:px-6 relative z-10 overflow-hidden border-t border-dark-base-secondary"
      style={{ background: 'radial-gradient(circle at 50% 0%, var(--dark-base-secondary) 0%, var(--dark-base-secondary) 35%, var(--dark-base-secondary) 70%, var(--dark-base-secondary) 100%)' }}>

      {/* Subtle diagonal background texture */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="diagonal-stripes" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="10" stroke="#ffffff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diagonal-stripes)" />
        </svg>
      </div>

      <div className="mx-auto max-w-7xl h-full flex flex-col relative z-10" ref={containerRef}>

        <div className="grid grid-cols-1 gap-12 md:gap-16 md:grid-cols-12 md:min-h-[520px] md:h-[520px] lg:h-[600px] items-start pt-0 md:pt-8">
          {/* Left Panel: Tabs & Controls */}
          <div className="col-span-1 md:col-span-5 flex flex-col gap-6 sm:gap-6 md:gap-8 md:h-full md:min-h-0">
            <h2 className="font-sans font-normal text-[40px] leading-[100%] tracking-[-0.16rem] lg:tracking-[-0.18rem] lg:-ml-1 lg:text-6xl 2xl:text-7xl text-balance" style={{ color: '#EEEEEE' }}>
              Learn systems exactly as they were built.
            </h2>
            <div className="flex flex-col gap-y-4 lg:max-w-[600px] lg:gap-y-6">
              <p className="font-mono text-[16px] leading-[120%] tracking-[-0.02rem] lg:text-[18px] lg:tracking-[-0.0225rem] text-neutral-500 text-balance">
                Forge embeds directly into your learning workflow, replacing unstructured docs with guided, block-by-block mastery.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:gap-3 mt-0 md:mt-4 relative">
              {FEATURES.map((feature, index) => {
                const isActive = activeIdx === index;
                return (
                  <button
                    key={feature.id}
                    onClick={() => {
                      const st = typeof window !== 'undefined' && window.innerWidth >= 768
                        ? ScrollTrigger.getAll().find(t => t.trigger === sectionRef.current)
                        : null;
                      if (st) {
                        const targetProgress = index / FEATURES.length;
                        const scrollPos = st.start + (st.end - st.start) * targetProgress;
                        window.scrollTo({ top: scrollPos, behavior: 'smooth' });
                      } else {
                        setPage([index, index > activeIdx ? 1 : -1]);
                      }
                    }}
                    className={`relative text-left px-4 py-3 sm:px-5 sm:py-4 md:px-6 md:py-5 border transition-colors duration-300 rounded-lg overflow-hidden group outline-none ${isActive ? 'bg-dark-base-primary border-neutral-800' : 'bg-transparent border-dark-base-secondary hover:bg-dark-base-secondary hover:border-neutral-800'
                      } active:scale-[0.98] transition-transform`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute left-0 top-0 w-1 h-full bg-safety-orange drop-shadow-[0_0_8px_rgba(255,77,0,0.5)]"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      />
                    )}
                    <div className="flex flex-col gap-2 relative z-10">
                      <div className="flex items-center justify-between">
                        <span className={`text-pretty font-mono text-[12px] leading-[100%] tracking-[-0.015rem] uppercase transition-colors duration-300 ${isActive ? 'text-safety-orange' : 'text-steel hover:text-pure-white'}`}>
                          0{index + 1} - {feature.label}
                        </span>
                      </div>
                      <AnimatePresence initial={false}>
                        {isActive && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 100, damping: 20 }}
                          >
                            <p className="text-pretty font-mono text-[14px] leading-[120%] tracking-[-0.0175rem] lg:text-[16px] lg:tracking-[-0.02rem] text-[rgba(161,161,170,0.8)] mt-1.5 sm:mt-2">
                              {feature.description}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Scrolling UI Mockups */}
          <div className="col-span-1 md:col-span-7 min-h-[360px] w-full relative md:min-h-0 md:h-[520px] lg:h-[600px]">
            {/* Outer wireframe container */}
            <div className="absolute inset-0 border border-dark-base-secondary rounded-xl sm:rounded-2xl bg-dark-base-primary p-1.5 sm:p-2 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]">
              <div className="w-full h-full border border-dark-base-secondary rounded-lg sm:rounded-xl overflow-hidden relative bg-dark-base-primary">

                <AnimatePresence initial={false} custom={direction}>
                  <motion.div
                    key={activeIdx}
                    custom={direction}
                    variants={variants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      y: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 },
                      filter: { duration: 0.3 }
                    }}
                    className="absolute inset-0 p-3 sm:p-5 md:p-8 lg:p-10 flex items-center justify-center"
                  >

                    {/* Panel 1: Storyboards */}
                    {activeFeature.id === 'storyboards' && (
                      <div className="w-full h-full border border-dark-base-secondary bg-dark-base-primary p-4 sm:p-6 md:p-8 rounded-lg sm:rounded-xl relative flex flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                        <div className="absolute top-0 left-0 w-0.5 sm:w-1 h-full bg-steel/30"></div>
                        <div className="mb-2 sm:mb-4 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-[9px] sm:text-[10px] text-steel tracking-widest uppercase bg-steel/10 px-2 py-0.5 sm:px-3 sm:py-1 rounded">Block 3 of 12</span>
                          <span className="font-mono text-[9px] sm:text-[10px] text-steel/50 border border-dark-base-secondary px-1.5 py-0.5 sm:px-2 sm:py-1 rounded">BACKEND PATH</span>
                        </div>
                        <h3 className="text-pure-white font-sans font-normal text-[18px] leading-[100%] tracking-normal lg:text-[24px] mb-2 sm:mb-3">Authentication Lifecycle</h3>
                        <p className="text-pretty font-mono text-[14px] leading-[120%] tracking-[-0.0175rem] lg:text-[16px] lg:tracking-[-0.02rem] text-steel/70 mb-4 sm:mb-6 max-w-[100%]">
                          Understand how requests traverse the backend and where session data is verified before reaching the core API controllers.
                        </p>

                        <div className="flex flex-wrap gap-2 sm:gap-4 mt-auto">
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-pure-white text-obsidian px-3 py-2 sm:px-5 sm:py-2.5 rounded font-sans text-[10px] sm:text-xs font-semibold transition-colors hover:bg-steel outline-none">
                            Mark Complete
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="border border-neutral-800 text-pure-white px-3 py-2 sm:px-5 sm:py-2.5 rounded font-sans text-[10px] sm:text-xs transition-colors hover:bg-dark-base-secondary outline-none">
                            View Diagram
                          </motion.button>
                        </div>
                      </div>
                    )}

                    {/* Panel 2: IDE Explorer */}
                    {activeFeature.id === 'ide' && (
                      <div className="w-full h-full flex flex-col border border-dark-base-secondary bg-dark-base-primary rounded-lg sm:rounded-xl overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                        <div className="flex items-center justify-between border-b border-dark-base-secondary bg-dark-base-primary px-2 py-2 sm:px-4 sm:py-3">
                          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                            <div className="flex gap-1 sm:gap-2 shrink-0">
                              <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-[#FF5F56]/20 border border-[#FF5F56]/50"></div>
                              <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-[#FFBD2E]/20 border border-[#FFBD2E]/50"></div>
                              <div className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-[#27C93F]/20 border border-[#27C93F]/50"></div>
                            </div>
                            <div className="flex items-center gap-1.5 sm:gap-2 font-mono text-[8px] sm:text-[10px] text-steel/70 tracking-widest truncate">
                              <TreeStructure size={10} className="shrink-0 sm:w-3 sm:h-3" />
                              <span>forge-workspace</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-1 overflow-hidden min-h-0">
                          <div className="w-36 sm:w-44 md:w-48 border-r border-dark-base-secondary bg-dark-base-primary p-2 sm:p-3 md:p-4 hidden md:block shrink-0">
                            <div className="font-mono text-[8px] md:text-[9px] uppercase tracking-widest text-steel/50 mb-2 md:mb-4 font-bold">Explorer</div>
                            <div className="font-mono text-[9px] md:text-[10px] text-steel/80 space-y-2 md:space-y-3">
                              <div className="flex items-center gap-1.5"><CaretRight size={8} className="rotate-90 text-steel/50 shrink-0 md:w-2.5 md:h-2.5" /> src</div>
                              <div className="pl-3 md:pl-4 flex items-center gap-1.5"><CaretRight size={8} className="rotate-90 text-steel/50 shrink-0 md:w-2.5 md:h-2.5" /> middleware</div>
                              <div className="pl-5 md:pl-8 text-pure-white bg-steel/10 -ml-1 md:-ml-2 px-1.5 py-0.5 rounded text-[9px]">AuthMiddleware.tsx</div>
                              <div className="pl-5 md:pl-8 text-steel/50 text-[9px]">RateLimit.tsx</div>
                              <div className="flex items-center gap-1.5"><CaretRight size={8} className="text-steel/50 shrink-0 md:w-2.5 md:h-2.5" /> routes</div>
                            </div>
                          </div>
                          <div className="p-3 sm:p-4 md:p-6 font-mono text-[9px] sm:text-[10px] md:text-[11px] text-steel leading-relaxed flex-1 overflow-auto relative bg-dark-base-primary min-w-0">
                            <motion.div
                              animate={{ y: [0, -5, 0] }}
                              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                            >
                              <pre className="whitespace-pre-wrap break-words">
                                <code className="text-steel/50">import</code> {'{ useState }'} <code className="text-steel/50">from</code> <code className="text-steel/80">'react'</code>;<br /><br />
                                <code className="text-[#A1A1AA]/40">{'// Forge Block 3: Authentication Lifecycle'}</code><br />
                                <code className="text-steel/50">export default function</code> <code className="text-pure-white">AuthMiddleware</code>() {'{'}<br />
                                {'  '}const [isValid, setIsValid] = useState(false);<br />
                                {'  '}// ...<br />
                                {'}'}
                              </pre>
                            </motion.div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Panel 3: Contextual Chat */}
                    {activeFeature.id === 'chat' && (
                      <div className="w-full h-full flex flex-col border border-dark-base-secondary bg-dark-base-primary rounded-lg sm:rounded-xl overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                        <div className="border-b border-dark-base-secondary p-2 sm:p-4 bg-dark-base-primary">
                          <span className="font-mono text-[8px] sm:text-[10px] text-steel/80 tracking-widest flex items-center gap-1.5 sm:gap-2">
                            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
                              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-safety-orange drop-shadow-[0_0_4px_rgba(255,77,0,0.8)]"></div>
                            </motion.div>
                            CONTEXTUAL AI CHAT
                          </span>
                        </div>
                        <div className="flex-1 p-3 sm:p-4 md:p-6 font-sans text-xs sm:text-sm space-y-4 sm:space-y-6 md:space-y-8 overflow-auto relative bg-dark-base-primary min-h-0">
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="flex gap-2 sm:gap-4 items-start"
                          >
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded border border-dark-base-secondary bg-dark-base-primary flex-shrink-0 flex items-center justify-center font-mono text-[8px] sm:text-[10px] text-steel">U</div>
                            <div className="text-steel/90 pt-0.5 sm:pt-1.5 text-[11px] sm:text-[13px] font-mono min-w-0 break-words">
                              What happens if <span className="text-pure-white bg-dark-base-secondary px-1 py-0.5 sm:px-1.5 rounded border border-neutral-800">verifyToken</span> fails?
                            </div>
                          </motion.div>
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 }}
                            className="flex gap-2 sm:gap-4 items-start"
                          >
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded border border-safety-orange/30 bg-safety-orange/10 flex-shrink-0 flex items-center justify-center">
                              <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-safety-orange drop-shadow-[0_0_6px_rgba(255,77,0,0.8)]"></div>
                              </motion.div>
                            </div>
                            <div className="text-steel/80 leading-relaxed pt-0.5 sm:pt-1.5 text-[11px] sm:text-[13px] font-mono min-w-0 break-words">
                              The component state <span className="bg-dark-base-secondary border border-neutral-800 px-1 py-0.5 sm:px-1.5 rounded text-pure-white">isValid</span> remains false, routing the user to <span className="text-pure-white bg-dark-base-secondary border border-neutral-800 px-1 py-0.5 sm:px-1.5 rounded text-[10px] sm:text-xs">&lt;LoginRedirect /&gt;</span>.<br /><br className="hidden sm:block" />
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="text-[9px] sm:text-[11px] border border-dark-base-secondary bg-dark-base-primary px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 hover:bg-dark-base-secondary cursor-pointer transition-colors text-steel shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] outline-none w-fit"
                              >
                                <FileCode size={10} className="shrink-0 sm:w-3 sm:h-3" /> Ref: src/utils/auth.ts
                              </motion.button>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    )}

                    {/* Panel 4: Roles */}
                    {activeFeature.id === 'roles' && (
                      <div className="w-full h-full flex flex-col justify-center gap-0 relative py-2 sm:py-0">

                        {/* Stacked Card Above (Faded) */}
                        <motion.div
                          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 0.2 }} transition={{ delay: 0.1 }}
                          className="relative z-0 flex items-center justify-between p-3 sm:p-5 border border-dark-base-secondary bg-dark-base-primary rounded-lg sm:rounded-xl w-[88%] sm:w-[90%] mx-auto scale-[0.95] translate-y-2 sm:translate-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                        >
                          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded bg-dark-base-primary border border-dark-base-secondary flex items-center justify-center shrink-0"></div>
                            <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                              <span className="font-sans text-xs sm:text-sm font-semibold text-transparent bg-steel/20 rounded w-16 sm:w-24 h-3 sm:h-4"></span>
                              <span className="font-mono text-[9px] sm:text-[10px] text-transparent bg-steel/10 rounded w-32 sm:w-48 h-2.5 sm:h-3"></span>
                            </div>
                          </div>
                        </motion.div>

                        {/* Active Card */}
                        <motion.div
                          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.2 }}
                          className="relative z-20 flex items-center justify-between gap-2 p-3 sm:p-5 border border-safety-orange bg-dark-base-primary rounded-lg sm:rounded-xl shadow-[0_0_40px_rgba(255,77,0,0.05),inset_0_1px_0_rgba(255,255,255,0.05)] w-full mx-auto"
                        >
                          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded bg-dark-base-primary border border-dark-base-secondary flex items-center justify-center shrink-0">
                              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
                                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-safety-orange drop-shadow-[0_0_6px_rgba(255,77,0,0.8)]"></div>
                              </motion.div>
                            </div>
                            <div className="flex flex-col gap-0 min-w-0">
                              <span className="font-sans text-xs sm:text-sm font-semibold text-pure-white tracking-tight">Frontend Path</span>
                              <span className="font-mono text-[9px] sm:text-[10px] text-steel/60 truncate sm:whitespace-normal">Skips DB internals, focuses on React state.</span>
                            </div>
                          </div>
                          <span className="font-mono text-[8px] sm:text-[9px] text-safety-orange bg-[var(--accent-100)]/10 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded font-bold tracking-widest border border-safety-orange/20 shrink-0">ACTIVE</span>
                        </motion.div>

                        {/* Stacked Card Below */}
                        <motion.div
                          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 0.6 }} transition={{ delay: 0.3 }}
                          className="relative z-10 flex items-center justify-between p-3 sm:p-5 border border-dark-base-secondary bg-dark-base-primary rounded-lg sm:rounded-xl w-[92%] sm:w-[95%] mx-auto -translate-y-1 sm:-translate-y-2 scale-[0.98] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                        >
                          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded bg-dark-base-primary border border-dark-base-secondary flex items-center justify-center shrink-0">
                              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-steel/30"></div>
                            </div>
                            <div className="flex flex-col gap-0 min-w-0">
                              <span className="font-sans text-xs sm:text-sm font-semibold text-steel tracking-tight">Backend Path</span>
                              <span className="font-mono text-[9px] sm:text-[10px] text-steel/40">Focuses on API, Postgres, Auth.</span>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>

              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}