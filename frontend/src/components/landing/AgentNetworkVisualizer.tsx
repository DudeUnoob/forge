"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AgentNetworkVisualizer({
  status,
  progress = 0
}: {
  status?: string | null;
  progress?: number;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    // If we're actively ingesting, stop the default cycle
    if (status) return;

    // Cycle through 4 frames every 4.5 seconds
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % 4);
    }, 3500);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    // Lock frame to actual progress when an ingest is active
    if (!status) return;

    if (progress < 35) {
      setFrame(0);
    } else if (progress >= 35 && progress < 65) {
      setFrame(1);
    } else if (progress >= 65 && progress < 90) {
      setFrame(2);
    } else {
      setFrame(3);
    }
  }, [status, progress]);

  // Premium bouncy physics from Taste.md
  const spring: any = { type: "spring", stiffness: 100, damping: 20 };

  return (
    <div className="relative flex h-[280px] min-h-[200px] w-full max-w-full items-center justify-center pointer-events-none sm:h-[350px] md:h-[450px] lg:h-[600px] overflow-hidden">
      {/* Background SVG / Blueprint Framing */}
      <svg className="absolute inset-0 h-full w-full" viewBox="-300 -300 600 600">
        <defs>
          <linearGradient id="scannerGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-100)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--accent-100)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--accent-100)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Concentric Squares */}
        <motion.rect
          x="-150"
          y="-150"
          width="300"
          height="300"
          fill="none"
          stroke="#A1A1AA"
          strokeWidth="1"
          strokeDasharray="4 4"
          initial={{ opacity: 0.3 }}
          animate={{
            opacity: frame >= 2 ? 0.08 : 0.3,
            rotate: [0, 360],
          }}
          transition={{
            opacity: { duration: 1.5, ease: "easeInOut" },
            rotate: { duration: 120, repeat: Infinity, ease: "linear" },
          }}
        />
        <motion.rect
          x="-220"
          y="-220"
          width="440"
          height="440"
          fill="none"
          stroke="#A1A1AA"
          strokeWidth="1"
          strokeDasharray="4 4"
          initial={{ opacity: 0.15 }}
          animate={{
            opacity: frame >= 2 ? 0.04 : 0.15,
            rotate: [0, -360],
          }}
          transition={{
            opacity: { duration: 1.5, ease: "easeInOut" },
            rotate: { duration: 160, repeat: Infinity, ease: "linear" },
          }}
        />

        {/* Crosshairs for inner square */}
        <motion.g
          stroke="#A1A1AA"
          strokeWidth="1"
          animate={{ opacity: frame >= 2 ? 0.2 : 0.5 }}
          transition={{ duration: 1.5 }}
        >
          <path d="M -155 -150 L -145 -150 M -150 -155 L -150 -145" />
          <path d="M 145 -150 L 155 -150 M 150 -155 L 150 -145" />
          <path d="M -155 150 L -145 150 M -150 145 L -150 155" />
          <path d="M 145 150 L 155 150 M 150 145 L 150 155" />
        </motion.g>

        {/* Sweeping Scanner Lines (Only vigorous in frame 0 & 1) */}
        <motion.line
          x1="-300"
          y1="-300"
          x2="-300"
          y2="300"
          stroke="url(#scannerGradient)"
          strokeWidth="2"
          animate={{
            x1: [-300, 300],
            x2: [-300, 300],
            opacity: frame <= 1 ? [0, 0.8, 0] : 0,
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.line
          x1="-300"
          y1="-300"
          x2="300"
          y2="-300"
          stroke="url(#scannerGradient)"
          strokeWidth="2"
          animate={{
            y1: [-300, 300],
            y2: [-300, 300],
            opacity: frame <= 1 ? [0, 0.5, 0] : 0,
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />

        {/* Node-Link Pipelines (Appear vividly in frame 1, fade in frame 3) */}
        <motion.g
          animate={{ opacity: frame === 3 ? 0.15 : 1 }}
          transition={{ duration: 1.5 }}
        >
          {/* Base Paths */}
          <path d="M -300 -80 C -200 -80, -150 0, 0 0" fill="none" stroke="#A1A1AA" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
          <path d="M -280 40 C -180 40, -120 0, 0 0" fill="none" stroke="#A1A1AA" strokeWidth="1" opacity="0.2" />
          <path d="M -250 150 C -150 150, -80 0, 0 0" fill="none" stroke="#A1A1AA" strokeWidth="1" opacity="0.2" />

          <path d="M 300 -120 C 200 -120, 150 0, 0 0" fill="none" stroke="#A1A1AA" strokeWidth="1" opacity="0.2" />
          <path d="M 260 60 C 160 60, 100 0, 0 0" fill="none" stroke="#A1A1AA" strokeWidth="1" opacity="0.2" />
          <path d="M 280 180 C 180 180, 120 0, 0 0" fill="none" stroke="#A1A1AA" strokeWidth="1" opacity="0.2" />

          {/* Active Data Streams (Only in frame 1 & 2) */}
          <motion.path
            d="M -250 150 C -150 150, -80 0, 0 0"
            fill="none"
            stroke="var(--accent-100)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            animate={{
              strokeDashoffset: [20, 0],
              opacity: frame === 1 || frame === 2 ? 0.6 : 0,
            }}
            transition={{
              strokeDashoffset: { duration: 1, repeat: Infinity, ease: "linear" },
              opacity: { duration: 0.5 },
            }}
          />
          <motion.path
            d="M 260 60 C 160 60, 100 0, 0 0"
            fill="none"
            stroke="var(--accent-100)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            animate={{
              strokeDashoffset: [0, 20],
              opacity: frame === 1 || frame === 2 ? 0.6 : 0,
            }}
            transition={{
              strokeDashoffset: { duration: 1, repeat: Infinity, ease: "linear" },
              opacity: { duration: 0.5 },
            }}
          />

          {/* Nodes */}
          <circle cx="-300" cy="-80" r="3" fill="#A1A1AA" opacity="0.5" />
          <circle cx="-280" cy="40" r="3" fill="#A1A1AA" opacity="0.5" />
          <motion.circle cx="-250" cy="150" r="3" fill="var(--accent-100)" animate={{ opacity: frame >= 1 ? 0.8 : 0.3 }} transition={{ duration: 0.8 }} />
          <circle cx="-160" cy="-80" r="3" fill="#A1A1AA" opacity="0.5" />
          <motion.circle cx="-100" cy="150" r="3" fill="var(--accent-100)" animate={{ opacity: frame >= 1 ? 0.8 : 0.3 }} transition={{ duration: 0.8 }} />

          <circle cx="300" cy="-120" r="3" fill="#A1A1AA" opacity="0.5" />
          <motion.circle cx="260" cy="60" r="3" fill="var(--accent-100)" animate={{ opacity: frame >= 1 ? 0.8 : 0.3 }} transition={{ duration: 0.8 }} />
          <circle cx="280" cy="180" r="3" fill="#A1A1AA" opacity="0.5" />
          <circle cx="150" cy="-120" r="3" fill="#A1A1AA" opacity="0.5" />
          <motion.circle cx="120" cy="60" r="3" fill="var(--accent-100)" animate={{ opacity: frame >= 1 ? 0.8 : 0.3 }} transition={{ duration: 0.8 }} />

          {/* Dynamic Traveling Particles (Only in frame 1 & 2) */}
          <motion.circle
            r="2"
            fill="var(--accent-100)"
            style={{ filter: "drop-shadow(0 0 6px var(--accent-100))" }}
            animate={{
              cx: [-250, 0],
              cy: [150, 0],
              opacity: frame === 1 || frame === 2 ? [0, 1, 0] : 0,
            }}
            transition={{
              cx: { duration: 3, repeat: Infinity, ease: "easeOut", delay: 0.5 },
              cy: { duration: 3, repeat: Infinity, ease: "easeOut", delay: 0.5 },
              opacity: { duration: 3, repeat: Infinity, ease: "easeOut", delay: 0.5 },
            }}
          />
          <motion.circle
            r="2"
            fill="var(--accent-100)"
            style={{ filter: "drop-shadow(0 0 6px var(--accent-100))" }}
            animate={{
              cx: [260, 0],
              cy: [60, 0],
              opacity: frame === 1 || frame === 2 ? [0, 1, 0] : 0,
            }}
            transition={{
              cx: { duration: 4, repeat: Infinity, ease: "easeOut", delay: 1.5 },
              cy: { duration: 4, repeat: Infinity, ease: "easeOut", delay: 1.5 },
              opacity: { duration: 4, repeat: Infinity, ease: "easeOut", delay: 1.5 },
            }}
          />
        </motion.g>
      </svg>

      {/* Central Rotating Emblem */}
      <motion.div
        className="absolute z-10 flex items-center justify-center bg-dark-base-primary/80 backdrop-blur-md"
        animate={{
          rotate: [0, 360],
          scale: frame === 3 ? 0.85 : 1, // Shrink slightly in frame 3 to yield focus
        }}
        transition={{
          rotate: { duration: 40, repeat: Infinity, ease: "linear" },
          scale: spring,
        }}
        style={{
          width: "6rem",
          height: "6rem",
          borderRadius: "0.75rem",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 40px rgba(0,0,0,0.5)",
          border: frame === 3 ? "1px solid rgba(255, 77, 0, 0.4)" : "1px solid transparent",
        }}
      >
        <svg
          viewBox="0 0 100 100"
          className="h-8 w-8 text-pure-white sm:h-10 sm:w-10 md:h-12 md:w-12"
          fill="currentColor"
        >
          <path d="M50,15 C52,25 58,35 65,40 C55,42 45,42 35,40 C42,35 48,25 50,15 Z" />
          <path d="M85,50 C75,52 65,58 60,65 C58,55 58,45 60,35 C65,42 75,48 85,50 Z" />
          <path d="M50,85 C48,75 42,65 35,60 C45,58 55,58 65,60 C58,65 52,75 50,85 Z" />
          <path d="M15,50 C25,48 35,42 40,35 C42,45 42,55 40,65 C35,58 25,52 15,50 Z" />

          <path d="M75,25 C68,32 62,42 65,50 C58,45 48,45 40,50 C48,42 55,32 60,25 C65,30 70,30 75,25 Z" opacity="0.6" />
          <path d="M75,75 C68,68 58,62 50,65 C55,58 55,48 50,40 C58,48 68,55 75,60 C70,65 70,70 75,75 Z" opacity="0.6" />
          <path d="M25,75 C32,68 42,62 40,50 C45,58 55,58 60,50 C52,58 42,65 35,70 C30,65 25,65 25,75 Z" opacity="0.6" />
          <path d="M25,25 C32,32 42,38 50,35 C45,42 45,52 50,60 C42,52 32,45 25,40 C30,35 30,30 25,25 Z" opacity="0.6" />
          <circle cx="50" cy="50" r="10" fill="var(--dark-base-primary)" />
          <circle cx="50" cy="50" r="6" fill="currentColor" />
        </svg>

        {/* Decorative corner marks */}
        <div className="absolute left-1 top-1 h-0.5 w-0.5 bg-steel/30" />
        <div className="absolute right-1 top-1 h-0.5 w-0.5 bg-steel/30" />
        <div className="absolute bottom-1 left-1 h-0.5 w-0.5 bg-steel/30" />
        <div className="absolute bottom-1 right-1 h-0.5 w-0.5 bg-steel/30" />
      </motion.div>

      {/* --- OVERLAYS VIA ANIMATEPRESENCE --- */}

      <AnimatePresence mode="wait">
        {/* FRAME 0: Initial Scan/Ingest Info */}
        {frame === 0 && (
          <motion.div
            key="frame0"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.4 } }}
            transition={spring}
            className="absolute top-[20%] z-20 flex items-center gap-2 rounded-full border border-steel/20 bg-dark-base-primary/80 px-4 py-2 shadow-lg backdrop-blur-sm"
          >
            <div className="h-2 w-2 rounded-full bg-steel animate-pulse" />
            <span className="font-mono text-[9px] sm:text-[11px] text-steel tracking-widest uppercase">
              {status ? "INITIALIZING UPLINK..." : "Awaiting Directives"}
            </span>
          </motion.div>
        )}

        {/* FRAME 1: System Logs / AST Building */}
        {frame === 1 && (
          <motion.div
            key="frame1"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, transition: { duration: 0.4 } }}
            transition={spring}
            className="absolute top-[35%] right-[5%] z-20 w-[150px] overflow-hidden rounded-xl border border-neutral-800/60 bg-dark-base-primary/90 font-mono text-[8px] shadow-2xl backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:w-[180px] md:w-[220px] lg:text-[10px]"
          >
            <div className="flex items-center gap-1.5 border-b border-neutral-800/60 bg-dark-base-secondary/80 px-3 py-2">
              <motion.div
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-2 w-2 rounded-full bg-safety-orange drop-shadow-[0_0_4px_rgba(255,77,0,0.8)]"
              />
              <span className="text-steel font-bold tracking-widest">SYSTEM_LOGS</span>
            </div>
            <div className="p-3 leading-relaxed text-steel/70 flex flex-col gap-1.5">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <span className="text-steel/40">[00:01]</span> Resolving tree...
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
                <span className="text-steel/40">[00:02]</span> Building AST models...
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.1 }}
                className="text-pure-white"
              >
                <span className="text-steel/40">[00:03]</span> <span className="text-safety-orange">Target isolated.</span>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* FRAME 2: Floating Execution Terminals */}
        {frame === 2 && (
          <React.Fragment key="frame2">
            {/* Terminal 1 */}
            <motion.div
              initial={{ opacity: 0, x: -60, rotate: -2 }}
              animate={{
                opacity: 1,
                x: 0,
                rotate: [-0.5, 0.5, -0.5],
                y: [-8, 8, -8],
              }}
              exit={{ opacity: 0, x: -60, transition: { duration: 0.4 } }}
              transition={{
                ...spring,
                y: { duration: 8, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 8, repeat: Infinity, ease: "easeInOut" },
              }}
              className="absolute left-[2%] top-[15%] z-20 w-[160px] overflow-hidden rounded-xl border border-neutral-800/60 bg-dark-base-primary/95 font-mono text-[8px] shadow-2xl backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:left-[6%] sm:w-[220px] sm:text-[9px] md:left-[10%] md:w-[260px] lg:w-[280px] lg:text-xs"
            >
              <div className="flex items-center gap-1.5 border-b border-neutral-800/60 bg-dark-base-secondary/80 px-3 py-2">
                <div className="h-2 w-2 rounded-full bg-steel/30" />
                <div className="h-2 w-2 rounded-full bg-steel/30" />
                <div className="h-2 w-2 rounded-full bg-steel/30" />
                <span className="ml-2 text-steel/50">agent_test.sh</span>
              </div>
              <div className="p-3 leading-relaxed text-steel md:p-4">
                <div className="text-pure-white">run_droid_test() {"{"}</div>
                <div className="pl-3 text-safety-orange">
                  droid --task "Run tests for $1"
                </div>
                <div>{"}"}</div>
                <br className="hidden sm:block" />
                <div className="text-pure-white">for file in tests:</div>
                <div className="pl-3">run_droid_test(file)</div>
                <div className="mt-3 flex justify-end">
                  <span className="rounded-[4px] bg-pure-white px-2 py-1 font-sans text-[9px] font-bold text-obsidian sm:text-[10px]">
                    RUN
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Terminal 2 */}
            <motion.div
              initial={{ opacity: 0, x: 60, rotate: 2 }}
              animate={{
                opacity: 1,
                x: 0,
                rotate: [0.5, -0.5, 0.5],
                y: [8, -8, 8],
              }}
              exit={{ opacity: 0, x: 60, transition: { duration: 0.4 } }}
              transition={{
                ...spring,
                y: { duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.2 },
                rotate: { duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.2 },
              }}
              className="absolute bottom-[10%] right-[2%] z-20 w-[160px] overflow-hidden rounded-xl border border-neutral-800/60 bg-dark-base-primary/95 font-mono text-[8px] shadow-2xl backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:right-[6%] sm:w-[220px] sm:text-[9px] md:right-[10%] md:w-[260px] lg:w-[280px] lg:text-xs"
            >
              <div className="flex items-center gap-1.5 border-b border-neutral-800/60 bg-dark-base-secondary/80 px-3 py-2">
                <div className="h-2 w-2 rounded-full bg-steel/30" />
                <div className="h-2 w-2 rounded-full bg-steel/30" />
                <div className="h-2 w-2 rounded-full bg-steel/30" />
                <span className="ml-2 text-steel/50">agent_fix.sh</span>
              </div>
              <div className="p-3 leading-relaxed text-steel md:p-4">
                <div className="text-pure-white">run_droid_fix() {"{"}</div>
                <div className="pl-3">echo "Processing $1"</div>
                <div className="pl-3 text-safety-orange">
                  droid --task "Fix the bug in $1"
                </div>
                <div>{"}"}</div>
                <br className="hidden sm:block" />
                <div className="text-pure-white">for bug in bugs:</div>
                <div className="pl-3">run_droid_fix(bug)</div>
                <div className="mt-3 flex justify-end">
                  <span className="rounded-[4px] bg-pure-white px-2 py-1 font-sans text-[9px] font-bold text-obsidian sm:text-[10px]">
                    RUN
                  </span>
                </div>
              </div>
            </motion.div>
          </React.Fragment>
        )}

        {/* FRAME 3: Telemetry & Lollipop Mock */}
        {frame === 3 && (
          <React.Fragment key="frame3">
            {/* Static Code Context */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              transition={spring}
              className="absolute top-[5%] right-[2%] sm:right-[5%] max-w-[200px] z-20 rounded-xl border border-neutral-800/60 bg-dark-base-primary/95 font-mono text-[7px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md sm:text-[9px] p-4 text-steel"
            >
              <div className="flex gap-1.5 mb-3">
                <div className="w-2 h-2 rounded-full bg-steel/30" />
                <div className="w-2 h-2 rounded-full bg-steel/30" />
                <div className="w-2 h-2 rounded-full bg-steel/30" />
              </div>
              <div><span className="text-steel/50">diverging_lollipop_plt (</span></div>
              <div className="pl-4 py-1.5 space-y-0.5">
                <div><span className="text-safety-orange">.data,</span></div>
                <div><span className="text-steel/70">.y_axis,</span></div>
                <div><span className="text-steel/70">.x_axis,</span></div>
                <div><span className="text-safety-orange">.plot.title = NULL,</span></div>
              </div>
              <div><span className="text-steel/50">)</span></div>
            </motion.div>

            {/* Lollipop Timeline 1 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.3 } }}
              transition={{ ...spring, delay: 0.1 }}
              className="absolute top-[25%] left-[8%] sm:left-[15%] z-20 flex items-center gap-3 rounded-full border border-neutral-800/60 bg-dark-base-primary/90 px-4 py-2 shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md w-[140px] sm:w-[180px]"
            >
              <div className="flex gap-1.5">
                <div className="h-2 w-2 rounded-full bg-steel/40" />
                <div className="h-2 w-2 rounded-full bg-steel/20" />
              </div>
              <div className="relative flex-1 h-[3px] bg-steel/10 rounded-full mx-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] border border-neutral-800/40 overflow-hidden">
                <motion.div className="absolute right-2 top-1/2 -translate-y-1/2 h-1.5 w-6 rounded-full bg-steel/50" />
                <motion.div
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-safety-orange shadow-[0_0_8px_var(--accent-100)]"
                  animate={{ left: ["0%", "75%", "0%"] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </motion.div>

            {/* Lollipop Timeline 2 */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, transition: { duration: 0.3 } }}
              transition={{ ...spring, delay: 0.25 }}
              className="absolute top-[45%] right-[15%] sm:right-[25%] z-20 flex items-center gap-3 rounded-full border border-neutral-800/60 bg-dark-base-primary/90 px-4 py-2 shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md w-[130px] sm:w-[160px]"
            >
              <div className="flex gap-1.5">
                <div className="h-2 w-2 rounded-full bg-steel/20" />
                <div className="h-2 w-2 rounded-full bg-steel/40" />
              </div>
              <div className="relative flex-1 h-[3px] bg-steel/10 rounded-full mx-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] border border-neutral-800/40">
                <motion.div className="absolute right-4 top-1/2 -translate-y-1/2 h-1.5 w-8 rounded-full bg-steel/40" />
                {/* Hollow white ring around orange inner like in image */}
                <motion.div
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-[10px] w-[10px] rounded-full bg-pure-white border-[2px] border-safety-orange outline outline-2 outline-pure-white/10 shadow-[0_0_10px_rgba(255,77,0,0.6)] box-border"
                  animate={{ right: ["0%", "65%", "0%"] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                />
              </div>
            </motion.div>

            {/* Lollipop Timeline 3 */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, transition: { duration: 0.3 } }}
              transition={{ ...spring, delay: 0.4 }}
              className="absolute bottom-[20%] left-[10%] sm:left-[20%] z-20 flex items-center gap-3 rounded-full border border-neutral-800/60 bg-dark-base-primary/90 px-4 py-2 shadow-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md w-[150px] sm:w-[200px]"
            >
              <div className="flex gap-1.5">
                <div className="h-2 w-2 rounded-full bg-steel/40" />
                <div className="h-2 w-4 rounded-full bg-steel/20" />
              </div>
              <div className="relative flex-1 h-[3px] bg-steel/10 rounded-full mx-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] border border-neutral-800/40">
                <motion.div
                  className="absolute left-[30%] top-1/2 -translate-y-1/2 h-[9px] w-[9px] rounded-full bg-safety-orange shadow-[0_0_8px_var(--accent-100)]"
                  animate={{ left: ["30%", "90%", "30%"] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                />
              </div>
            </motion.div>

          </React.Fragment>
        )}
      </AnimatePresence>

    </div>
  );
}
