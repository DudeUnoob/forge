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

export default function ShowcaseSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeFeature, setActiveFeature] = useState(FEATURES[0].id);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    if (!sectionRef.current || !rightColRef.current || !leftColRef.current || !containerRef.current) return;

    // Pin the entire section
    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top top',
      end: '+=300%', // Scroll for 3 screen heights
      pin: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        const progress = self.progress;
        let activeIdx = Math.floor(progress * FEATURES.length);
        if (activeIdx >= FEATURES.length) activeIdx = FEATURES.length - 1;
        setActiveFeature(FEATURES[activeIdx].id);
      }
    });

    // Animate the right column content vertically based on scroll
    gsap.to(rightColRef.current, {
      yPercent: -75, // Assuming 4 panels, we move up 75% to show the last one
      ease: 'none',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top top',
        end: '+=300%',
        scrub: 1,
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <section ref={sectionRef} id="features" className="min-h-[100dvh] bg-obsidian py-24 px-6 relative z-10 overflow-hidden">
      <div className="mx-auto max-w-7xl h-full flex flex-col" ref={containerRef}>
        
        <div className="grid grid-cols-1 gap-16 md:grid-cols-12 h-full items-center flex-1">
          {/* Left Panel: Tabs & Controls */}
          <div ref={leftColRef} className="col-span-1 md:col-span-5 flex flex-col gap-12 h-full justify-center">
            <h2 className="font-sans text-4xl font-semibold tracking-tighter text-pure-white md:text-6xl">
              Learn systems exactly as they were built.
            </h2>
            <p className="font-sans text-lg text-steel max-w-[40ch]">
              Forge embeds directly into your learning workflow, replacing unstructured docs with guided, block-by-block mastery.
            </p>

            <div className="flex flex-col gap-4 mt-8 relative">
              {FEATURES.map((feature, index) => {
                const isActive = activeFeature === feature.id;
                return (
                  <button
                    key={feature.id}
                    onClick={() => {
                      // Optionally, implement click-to-scroll here if needed
                    }}
                    className={`relative text-left px-6 py-4 border border-[#313150] transition-colors duration-300 rounded-lg overflow-hidden group ${
                      isActive ? 'bg-[#0A0A0A]' : 'bg-transparent hover:bg-[#11111A]'
                    }`}
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
                        <span className={`font-mono text-xs tracking-widest uppercase transition-colors duration-300 ${isActive ? 'text-safety-orange' : 'text-steel group-hover:text-pure-white'}`}>
                          0{index + 1} - {feature.label}
                        </span>
                      </div>
                      <AnimatePresence>
                        {isActive && (
                          <motion.p
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="font-sans text-sm text-steel leading-relaxed"
                          >
                            {feature.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Scrolling UI Mockups */}
          <div className="col-span-1 md:col-span-7 h-[600px] overflow-hidden rounded-lg relative bg-obsidian">
            <div ref={rightColRef} className="flex flex-col w-full h-[400%]">
              
              {/* Panel 1: Storyboards */}
              <div className="h-[25%] p-8 w-full flex items-center justify-center border border-[#313150] bg-[#0A0A0A] rounded-lg">
                 <div className="w-full h-full border border-safety-orange/30 bg-[#0A0A0A] p-8 rounded-lg relative overflow-hidden flex flex-col justify-center">
                    <div className="absolute top-0 left-0 w-1 h-full bg-safety-orange drop-shadow-[0_0_8px_rgba(255,77,0,0.8)]"></div>
                    <div className="mb-4 flex items-center justify-between">
                      <span className="font-mono text-xs text-safety-orange tracking-widest uppercase bg-safety-orange/10 px-3 py-1 rounded">Block 3 of 12</span>
                      <span className="font-mono text-[10px] text-steel border border-[#313150] px-2 py-1 rounded">BACKEND PATH</span>
                    </div>
                    <h3 className="font-sans text-3xl font-semibold text-pure-white tracking-tighter mb-4">Authentication Lifecycle</h3>
                    <p className="font-sans text-base text-steel leading-relaxed mb-8">
                      Understand how requests traverse the backend and where session data is verified before reaching the core API controllers.
                    </p>
                    
                    <div className="flex gap-4">
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-pure-white text-obsidian px-6 py-3 font-sans text-sm font-bold transition-colors hover:bg-safety-orange hover:text-pure-white drop-shadow-[0_0_12px_rgba(255,77,0,0.3)]">
                        Mark Complete
                      </motion.button>
                      <button className="border border-[#313150] text-pure-white px-6 py-3 font-sans text-sm transition-colors hover:bg-[#1A1A1A]">
                        View Diagram
                      </button>
                    </div>
                 </div>
              </div>

              {/* Panel 2: IDE Explorer */}
              <div className="h-[25%] p-8 w-full flex items-center justify-center border border-[#313150] bg-[#0A0A0A] rounded-lg mt-8">
                 <div className="w-full h-full flex flex-col border border-[#313150] bg-[#050505] rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[#313150] bg-[#11111A] px-4 py-3">
                      <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                          <div className="h-3 w-3 rounded-full bg-[#FF5F56]"></div>
                          <div className="h-3 w-3 rounded-full bg-[#FFBD2E]"></div>
                          <div className="h-3 w-3 rounded-full bg-[#27C93F]"></div>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs text-steel">
                          <TreeStructure size={14} />
                          <span>forge-workspace</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-1 overflow-hidden">
                      <div className="w-48 border-r border-[#313150] bg-[#0A0A0A] p-4 hidden md:block">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-steel mb-4 font-bold">Explorer</div>
                        <div className="font-mono text-xs text-steel space-y-3">
                          <div className="flex items-center gap-2 text-pure-white"><CaretRight size={10} className="rotate-90"/> src</div>
                          <div className="pl-4 flex items-center gap-2"><CaretRight size={10} className="rotate-90"/> middleware</div>
                          <div className="pl-8 text-safety-orange font-bold drop-shadow-[0_0_4px_rgba(255,77,0,0.5)]">AuthMiddleware.tsx</div>
                          <div className="pl-8">RateLimit.tsx</div>
                          <div className="flex items-center gap-2"><CaretRight size={10}/> routes</div>
                        </div>
                      </div>
                      <div className="p-6 font-mono text-sm text-steel leading-relaxed flex-1 overflow-hidden relative">
                        <motion.div 
                          animate={{ y: [0, -5, 0] }} 
                          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                        >
                          <pre>
                            <code className="text-[#A6E3A1]">import</code> {'{ useState }'} <code className="text-[#A6E3A1]">from</code> <code className="text-[#F9E2AF]">'react'</code>;<br/><br/>
                            <code className="text-[#6c7086]">{'// Forge Block 3: Authentication Lifecycle'}</code><br/>
                            <code className="text-[#A6E3A1]">export default function</code> <code className="text-[#89B4FA]">AuthMiddleware</code>() {'{'}<br/>
                            {'  '}const [isValid, setIsValid] = useState(false);<br/>
                            {'  '}// ...<br/>
                            {'}'}
                          </pre>
                        </motion.div>
                      </div>
                    </div>
                 </div>
              </div>

              {/* Panel 3: Contextual Chat */}
              <div className="h-[25%] p-8 w-full flex items-center justify-center border border-[#313150] bg-[#0A0A0A] rounded-lg mt-8">
                 <div className="w-full h-full flex flex-col border border-[#313150] bg-[#050505] rounded-lg overflow-hidden">
                    <div className="border-b border-[#313150] p-4 bg-[#11111A]">
                       <span className="font-mono text-xs text-pure-white tracking-widest flex items-center gap-2">
                          <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                            <ChatTeardropText size={16} className="text-safety-orange drop-shadow-[0_0_8px_rgba(255,77,0,0.8)]"/>
                          </motion.div>
                          CONTEXTUAL AI CHAT
                       </span>
                    </div>
                    <div className="flex-1 p-6 font-sans text-sm space-y-6 overflow-hidden relative">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded bg-[#313150] flex-shrink-0 flex items-center justify-center font-mono text-xs">U</div>
                          <div className="text-pure-white pt-1">
                            What happens if <code className="font-mono text-xs text-safety-orange bg-[#1A1A1A] px-1 py-0.5 rounded">verifyToken</code> fails?
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded bg-safety-orange flex-shrink-0 flex items-center justify-center font-mono text-xs text-obsidian font-bold drop-shadow-[0_0_8px_rgba(255,77,0,0.5)]">AI</div>
                          <div className="text-steel leading-relaxed pt-1">
                            The component state <code className="font-mono text-xs bg-[#1A1A1A] px-1 py-0.5 rounded">isValid</code> remains false, routing the user to <code className="font-mono text-xs text-[#a6e3a1] bg-[#1A1A1A] px-1 py-0.5 rounded">&lt;LoginRedirect /&gt;</code>.<br/><br/>
                            <span className="text-xs border border-[#313150] px-2 py-1 rounded flex items-center gap-2 inline-flex mt-2 hover:bg-[#1A1A1A] cursor-pointer transition-colors">
                              <FileCode size={12}/> Ref: src/utils/auth.ts
                            </span>
                          </div>
                        </div>
                    </div>
                 </div>
              </div>

              {/* Panel 4: Roles */}
              <div className="h-[25%] p-8 w-full flex items-center justify-center border border-[#313150] bg-[#0A0A0A] rounded-lg mt-8">
                 <div className="w-full h-full flex flex-col justify-center gap-6">
                    <motion.div whileHover={{ x: 10 }} className="flex items-center justify-between p-6 border border-safety-orange bg-safety-orange/5 rounded-lg cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-[#11111A] border border-[#313150] flex items-center justify-center group-hover:border-safety-orange transition-colors">
                          <div className="w-2 h-2 rounded-full bg-safety-orange drop-shadow-[0_0_8px_rgba(255,77,0,0.8)]"></div>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-sans text-lg font-bold text-pure-white group-hover:text-safety-orange transition-colors">Frontend Path</span>
                          <span className="font-mono text-xs text-steel">Skips DB internals, focuses on React state.</span>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-safety-orange bg-[#1A1A1A] px-2 py-1 rounded">ACTIVE</span>
                    </motion.div>

                    <motion.div whileHover={{ x: 10 }} className="flex items-center justify-between p-6 border border-[#313150] bg-[#050505] rounded-lg cursor-pointer group hover:border-steel">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded bg-[#11111A] border border-[#313150] flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-steel"></div>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-sans text-lg font-bold text-pure-white group-hover:text-steel transition-colors">Backend Path</span>
                          <span className="font-mono text-xs text-steel">Focuses on API, Postgres, Auth.</span>
                        </div>
                      </div>
                    </motion.div>
                 </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
