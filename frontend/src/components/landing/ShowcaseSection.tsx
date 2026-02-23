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

    if (!sectionRef.current) return;

    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top top',
      end: '+=300%', // Scroll for 3 screen heights
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
          if (prev[0] !== idx) {
             return [idx, idx > prev[0] ? 1 : -1];
          }
          return prev;
        });
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <section ref={sectionRef} id="features" className="min-h-[100dvh] bg-obsidian py-24 px-6 relative z-10 overflow-hidden border-t border-[#1A1A1A]">
      <div className="mx-auto max-w-7xl h-full flex flex-col" ref={containerRef}>
        
        <div className="grid grid-cols-1 gap-12 md:gap-16 md:grid-cols-12 h-[600px] items-start pt-8">
          {/* Left Panel: Tabs & Controls */}
          <div className="col-span-1 md:col-span-5 flex flex-col gap-8 h-full">
            <h2 className="font-sans text-5xl font-bold tracking-tighter text-pure-white md:text-6xl lg:text-7xl leading-[1.05]">
              Learn systems exactly as they were built.
            </h2>
            <p className="font-sans text-lg text-steel max-w-[38ch]">
              Forge embeds directly into your learning workflow, replacing unstructured docs with guided, block-by-block mastery.
            </p>

            <div className="flex flex-col gap-3 mt-4 relative">
              {FEATURES.map((feature, index) => {
                const isActive = activeIdx === index;
                return (
                  <button
                    key={feature.id}
                    onClick={() => {
                      const st = ScrollTrigger.getAll().find(t => t.trigger === sectionRef.current);
                      if (st) {
                        const targetProgress = index / FEATURES.length;
                        const scrollPos = st.start + (st.end - st.start) * targetProgress;
                        window.scrollTo({ top: scrollPos, behavior: 'smooth' });
                      }
                    }}
                    className={`relative text-left px-6 py-5 border transition-colors duration-300 rounded-lg overflow-hidden group outline-none ${
                      isActive ? 'bg-[#0A0A0A] border-[#313150]' : 'bg-transparent border-[#1A1A1A] hover:bg-[#11111A] hover:border-[#313150]'
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
                        <span className={`font-mono text-[11px] tracking-widest uppercase transition-colors duration-300 ${isActive ? 'text-safety-orange' : 'text-steel/50 group-hover:text-steel'}`}>
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
                            <p className="font-sans text-sm text-steel/80 leading-relaxed mt-2">
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
          <div className="col-span-1 md:col-span-7 h-[600px] w-full relative">
            {/* Outer wireframe container */}
            <div className="absolute inset-0 border border-[#1A1A1A] rounded-2xl bg-[#050505] p-2 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)]">
              <div className="w-full h-full border border-[#1A1A1A] rounded-xl overflow-hidden relative bg-[#020202]">
                
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
                    className="absolute inset-0 p-4 md:p-10 flex items-center justify-center"
                  >
                    
                    {/* Panel 1: Storyboards */}
                    {activeFeature.id === 'storyboards' && (
                       <div className="w-full h-full border border-[#1A1A1A] bg-[#0A0A0A] p-8 rounded-xl relative flex flex-col shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                          <div className="absolute top-0 left-0 w-1 h-full bg-steel/30"></div>
                          <div className="mb-4 flex items-center justify-between">
                            <span className="font-mono text-[10px] text-steel tracking-widest uppercase bg-steel/10 px-3 py-1 rounded">Block 3 of 12</span>
                            <span className="font-mono text-[10px] text-steel/50 border border-[#1A1A1A] px-2 py-1 rounded">BACKEND PATH</span>
                          </div>
                          <h3 className="font-sans text-2xl font-medium text-pure-white tracking-tight mb-3">Authentication Lifecycle</h3>
                          <p className="font-sans text-sm text-steel/70 leading-relaxed mb-6 max-w-[90%]">
                            Understand how requests traverse the backend and where session data is verified before reaching the core API controllers.
                          </p>
                          
                          <div className="flex gap-4 mt-auto">
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="bg-pure-white text-obsidian px-5 py-2.5 rounded font-sans text-xs font-semibold transition-colors hover:bg-steel outline-none">
                              Mark Complete
                            </motion.button>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="border border-[#313150] text-pure-white px-5 py-2.5 rounded font-sans text-xs transition-colors hover:bg-[#1A1A1A] outline-none">
                              View Diagram
                            </motion.button>
                          </div>
                       </div>
                    )}

                    {/* Panel 2: IDE Explorer */}
                    {activeFeature.id === 'ide' && (
                       <div className="w-full h-full flex flex-col border border-[#1A1A1A] bg-[#050505] rounded-xl overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                          <div className="flex items-center justify-between border-b border-[#1A1A1A] bg-[#0A0A0A] px-4 py-3">
                            <div className="flex items-center gap-4">
                              <div className="flex gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]/20 border border-[#FF5F56]/50"></div>
                                <div className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]/20 border border-[#FFBD2E]/50"></div>
                                <div className="h-2.5 w-2.5 rounded-full bg-[#27C93F]/20 border border-[#27C93F]/50"></div>
                              </div>
                              <div className="flex items-center gap-2 font-mono text-[10px] text-steel/70 tracking-widest">
                                <TreeStructure size={12} />
                                <span>forge-workspace</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-1 overflow-hidden">
                            <div className="w-48 border-r border-[#1A1A1A] bg-[#0A0A0A] p-4 hidden md:block">
                              <div className="font-mono text-[9px] uppercase tracking-widest text-steel/50 mb-4 font-bold">Explorer</div>
                              <div className="font-mono text-[10px] text-steel/80 space-y-3">
                                <div className="flex items-center gap-2"><CaretRight size={10} className="rotate-90 text-steel/50"/> src</div>
                                <div className="pl-4 flex items-center gap-2"><CaretRight size={10} className="rotate-90 text-steel/50"/> middleware</div>
                                <div className="pl-8 text-pure-white bg-steel/10 -ml-2 px-2 py-0.5 rounded">AuthMiddleware.tsx</div>
                                <div className="pl-8 text-steel/50">RateLimit.tsx</div>
                                <div className="flex items-center gap-2"><CaretRight size={10} className="text-steel/50"/> routes</div>
                              </div>
                            </div>
                            <div className="p-6 font-mono text-[11px] text-steel leading-relaxed flex-1 overflow-hidden relative bg-[#020202]">
                              <motion.div 
                                animate={{ y: [0, -5, 0] }} 
                                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                              >
                                <pre>
                                  <code className="text-steel/50">import</code> {'{ useState }'} <code className="text-steel/50">from</code> <code className="text-steel/80">'react'</code>;<br/><br/>
                                  <code className="text-[#A1A1AA]/40">{'// Forge Block 3: Authentication Lifecycle'}</code><br/>
                                  <code className="text-steel/50">export default function</code> <code className="text-pure-white">AuthMiddleware</code>() {'{'}<br/>
                                  {'  '}const [isValid, setIsValid] = useState(false);<br/>
                                  {'  '}// ...<br/>
                                  {'}'}
                                </pre>
                              </motion.div>
                            </div>
                          </div>
                       </div>
                    )}

                    {/* Panel 3: Contextual Chat */}
                    {activeFeature.id === 'chat' && (
                       <div className="w-full h-full flex flex-col border border-[#1A1A1A] bg-[#050505] rounded-xl overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                          <div className="border-b border-[#1A1A1A] p-4 bg-[#0A0A0A]">
                             <span className="font-mono text-[10px] text-steel/80 tracking-widest flex items-center gap-2">
                                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
                                  <div className="w-1.5 h-1.5 rounded-full bg-safety-orange drop-shadow-[0_0_4px_rgba(255,77,0,0.8)]"></div>
                                </motion.div>
                                CONTEXTUAL AI CHAT
                             </span>
                          </div>
                          <div className="flex-1 p-6 font-sans text-sm space-y-8 overflow-hidden relative bg-[#050505]">
                              <motion.div 
                                initial={{ opacity: 0, x: -10 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                transition={{ delay: 0.2 }}
                                className="flex gap-4 items-start"
                              >
                                <div className="w-8 h-8 rounded border border-[#1A1A1A] bg-[#0A0A0A] flex-shrink-0 flex items-center justify-center font-mono text-[10px] text-steel">U</div>
                                <div className="text-steel/90 pt-1.5 text-[13px] font-mono">
                                  What happens if <span className="text-pure-white bg-[#1A1A1A] px-1.5 py-0.5 rounded border border-[#313150]">verifyToken</span> fails?
                                </div>
                              </motion.div>
                              <motion.div 
                                initial={{ opacity: 0, x: -10 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                transition={{ delay: 0.6 }}
                                className="flex gap-4 items-start"
                              >
                                <div className="w-8 h-8 rounded border border-safety-orange/30 bg-safety-orange/10 flex-shrink-0 flex items-center justify-center">
                                  <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                    <div className="w-2 h-2 bg-safety-orange drop-shadow-[0_0_6px_rgba(255,77,0,0.8)]"></div>
                                  </motion.div>
                                </div>
                                <div className="text-steel/80 leading-relaxed pt-1.5 text-[13px] font-mono">
                                  The component state <span className="bg-[#1A1A1A] border border-[#313150] px-1.5 py-0.5 rounded text-pure-white">isValid</span> remains false, routing the user to <span className="text-pure-white bg-[#1A1A1A] border border-[#313150] px-1.5 py-0.5 rounded">&lt;LoginRedirect /&gt;</span>.<br/><br/>
                                  <motion.button 
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="text-[11px] border border-[#1A1A1A] bg-[#0A0A0A] px-2.5 py-1 rounded-md flex items-center gap-2 mt-2 hover:bg-[#11111A] cursor-pointer transition-colors text-steel shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] outline-none"
                                  >
                                    <FileCode size={12}/> Ref: src/utils/auth.ts
                                  </motion.button>
                                </div>
                              </motion.div>
                          </div>
                       </div>
                    )}

                    {/* Panel 4: Roles */}
                    {activeFeature.id === 'roles' && (
                       <div className="w-full h-full flex flex-col justify-center gap-0 relative">
                          
                          {/* Stacked Card Above (Faded) */}
                          <motion.div 
                            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 0.2 }} transition={{ delay: 0.1 }}
                            className="relative z-0 flex items-center justify-between p-5 border border-[#1A1A1A] bg-[#050505] rounded-xl w-[90%] mx-auto scale-[0.95] translate-y-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-9 h-9 rounded bg-[#020202] border border-[#1A1A1A] flex items-center justify-center"></div>
                              <div className="flex flex-col gap-1">
                                <span className="font-sans text-sm font-semibold text-transparent bg-steel/20 rounded w-24 h-4"></span>
                                <span className="font-mono text-[10px] text-transparent bg-steel/10 rounded w-48 h-3"></span>
                              </div>
                            </div>
                          </motion.div>

                          {/* Active Card */}
                          <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.2 }}
                            className="relative z-20 flex items-center justify-between p-5 border border-safety-orange bg-[#0A0A0A] rounded-xl shadow-[0_0_40px_rgba(255,77,0,0.05),inset_0_1px_0_rgba(255,255,255,0.05)] w-[100%] mx-auto"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-9 h-9 rounded bg-[#050505] border border-[#1A1A1A] flex items-center justify-center">
                                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}>
                                  <div className="w-1.5 h-1.5 rounded-full bg-safety-orange drop-shadow-[0_0_6px_rgba(255,77,0,0.8)]"></div>
                                </motion.div>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-sans text-sm font-semibold text-pure-white tracking-tight">Frontend Path</span>
                                <span className="font-mono text-[10px] text-steel/60">Skips DB internals, focuses on React state.</span>
                              </div>
                            </div>
                            <span className="font-mono text-[9px] text-safety-orange bg-[#FF4D00]/10 px-2 py-1 rounded font-bold tracking-widest border border-safety-orange/20">ACTIVE</span>
                          </motion.div>

                          {/* Stacked Card Below */}
                          <motion.div 
                            initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 0.6 }} transition={{ delay: 0.3 }}
                            className="relative z-10 flex items-center justify-between p-5 border border-[#1A1A1A] bg-[#050505] rounded-xl w-[95%] mx-auto -translate-y-2 scale-[0.98] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-9 h-9 rounded bg-[#020202] border border-[#1A1A1A] flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-steel/30"></div>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="font-sans text-sm font-semibold text-steel tracking-tight">Backend Path</span>
                                <span className="font-mono text-[10px] text-steel/40">Focuses on API, Postgres, Auth.</span>
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