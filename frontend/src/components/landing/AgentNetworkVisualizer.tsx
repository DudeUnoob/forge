'use client';

import { motion } from 'framer-motion';

export default function AgentNetworkVisualizer() {
  return (
    <div className="relative flex h-[240px] min-h-[200px] w-full max-w-full items-center justify-center pointer-events-none sm:h-[320px] md:h-[420px] lg:h-[560px] xl:h-[600px]">
      {/* Background SVG / Blueprint Framing */}
      <svg className="absolute inset-0 h-full w-full" viewBox="-300 -300 600 600">
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
          opacity="0.3"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
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
          opacity="0.15"
          animate={{ rotate: [0, -360] }}
          transition={{ duration: 160, repeat: Infinity, ease: 'linear' }}
        />

        {/* Crosshairs for inner square */}
        <g stroke="#A1A1AA" strokeWidth="1" opacity="0.5">
          <path d="M -155 -150 L -145 -150 M -150 -155 L -150 -145" />
          <path d="M 145 -150 L 155 -150 M 150 -155 L 150 -145" />
          <path d="M -155 150 L -145 150 M -150 145 L -150 155" />
          <path d="M 145 150 L 155 150 M 150 145 L 150 155" />
        </g>

        {/* Crosshairs for outer square */}
        <g stroke="#A1A1AA" strokeWidth="1" opacity="0.3">
          <path d="M -225 -220 L -215 -220 M -220 -225 L -220 -215" />
          <path d="M 215 -220 L 225 -220 M 220 -225 L 220 -215" />
          <path d="M -225 220 L -215 220 M -220 215 L -220 225" />
          <path d="M 215 220 L 225 220 M 220 215 L 220 225" />
        </g>

        {/* Node-Link Pipelines */}
        {/* Left Side */}
        <path d="M -300 -80 C -200 -80, -150 0, 0 0" fill="none" stroke="#A1A1AA" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />
        <path d="M -280 40 C -180 40, -120 0, 0 0" fill="none" stroke="#A1A1AA" strokeWidth="1" opacity="0.2" />
        <path d="M -250 150 C -150 150, -80 0, 0 0" fill="none" stroke="#FF4D00" strokeWidth="1" opacity="0.4" />
        
        {/* Right Side */}
        <path d="M 300 -120 C 200 -120, 150 0, 0 0" fill="none" stroke="#A1A1AA" strokeWidth="1" opacity="0.2" />
        <path d="M 260 60 C 160 60, 100 0, 0 0" fill="none" stroke="#FF4D00" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
        <path d="M 280 180 C 180 180, 120 0, 0 0" fill="none" stroke="#A1A1AA" strokeWidth="1" opacity="0.2" />

        {/* Nodes */}
        <circle cx="-300" cy="-80" r="3" fill="#A1A1AA" opacity="0.5" />
        <circle cx="-280" cy="40" r="3" fill="#A1A1AA" opacity="0.5" />
        <circle cx="-250" cy="150" r="3" fill="#FF4D00" opacity="0.8" />
        <circle cx="-160" cy="-80" r="3" fill="#A1A1AA" opacity="0.5" />
        <circle cx="-100" cy="150" r="3" fill="#FF4D00" opacity="0.8" />

        <circle cx="300" cy="-120" r="3" fill="#A1A1AA" opacity="0.5" />
        <circle cx="260" cy="60" r="3" fill="#FF4D00" opacity="0.8" />
        <circle cx="280" cy="180" r="3" fill="#A1A1AA" opacity="0.5" />
        <circle cx="150" cy="-120" r="3" fill="#A1A1AA" opacity="0.5" />
        <circle cx="120" cy="60" r="3" fill="#FF4D00" opacity="0.8" />
      </svg>

      {/* Central Rotating Emblem */}
      <motion.div
        className="absolute z-10 flex h-16 w-16 items-center justify-center rounded-xl bg-[#080808]/80 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_40px_rgba(0,0,0,0.5)] sm:h-20 sm:w-20 sm:rounded-2xl md:h-24 md:w-24 lg:h-32 lg:w-32"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 100 100" className="h-8 w-8 text-pure-white sm:h-10 sm:w-10 md:h-12 md:w-12 lg:h-16 lg:w-16" fill="currentColor">
          <path d="M50,15 C52,25 58,35 65,40 C55,42 45,42 35,40 C42,35 48,25 50,15 Z" />
          <path d="M85,50 C75,52 65,58 60,65 C58,55 58,45 60,35 C65,42 75,48 85,50 Z" />
          <path d="M50,85 C48,75 42,65 35,60 C45,58 55,58 65,60 C58,65 52,75 50,85 Z" />
          <path d="M15,50 C25,48 35,42 40,35 C42,45 42,55 40,65 C35,58 25,52 15,50 Z" />
          
          <path d="M75,25 C68,32 62,42 65,50 C58,45 48,45 40,50 C48,42 55,32 60,25 C65,30 70,30 75,25 Z" opacity="0.6"/>
          <path d="M75,75 C68,68 58,62 50,65 C55,58 55,48 50,40 C58,48 68,55 75,60 C70,65 70,70 75,75 Z" opacity="0.6"/>
          <path d="M25,75 C32,68 42,62 40,50 C45,58 55,58 60,50 C52,58 42,65 35,70 C30,65 25,65 25,75 Z" opacity="0.6"/>
          <path d="M25,25 C32,32 42,38 50,35 C45,42 45,52 50,60 C42,52 32,45 25,40 C30,35 30,30 25,25 Z" opacity="0.6"/>
          <circle cx="50" cy="50" r="10" fill="#050505" />
          <circle cx="50" cy="50" r="6" fill="currentColor" />
        </svg>

        {/* Decorative corner marks for the emblem box */}
        <div className="absolute left-1 top-1 h-0.5 w-0.5 bg-steel/30 sm:left-1.5 sm:top-1.5 sm:h-1 sm:w-1 lg:left-2 lg:top-2" />
        <div className="absolute right-1 top-1 h-0.5 w-0.5 bg-steel/30 sm:right-1.5 sm:top-1.5 sm:h-1 sm:w-1 lg:right-2 lg:top-2" />
        <div className="absolute bottom-1 left-1 h-0.5 w-0.5 bg-steel/30 sm:bottom-1.5 sm:left-1.5 sm:h-1 sm:w-1 lg:bottom-2 lg:left-2" />
        <div className="absolute bottom-1 right-1 h-0.5 w-0.5 bg-steel/30 sm:bottom-1.5 sm:right-1.5 sm:h-1 sm:w-1 lg:bottom-2 lg:right-2" />
      </motion.div>

      {/* Floating Code Terminal 1 */}
      <motion.div
        className="absolute left-0 top-[5%] z-20 w-[160px] overflow-hidden rounded border border-[#313150]/60 bg-[#0A0A0A]/90 font-mono text-[8px] shadow-2xl backdrop-blur-sm sm:left-2 sm:top-[12%] sm:w-[200px] sm:text-[9px] md:left-4 md:w-[240px] md:top-1/4 lg:left-8 lg:w-[280px] lg:text-xs"
        animate={{ y: [-15, 15, -15], rotate: [-0.5, 0.5, -0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="flex items-center gap-1 border-b border-[#313150]/60 bg-[#111111]/80 px-2 py-1.5 sm:gap-1.5 sm:px-3 sm:py-2">
          <div className="h-2 w-2 rounded-full bg-steel/30" />
          <div className="h-2 w-2 rounded-full bg-steel/30" />
          <div className="h-2 w-2 rounded-full bg-steel/30" />
          <span className="ml-1.5 text-steel/50 sm:ml-2">agent_test.sh</span>
        </div>
        <div className="p-2 leading-relaxed text-steel sm:p-3 md:p-4">
          <div className="text-pure-white">run_droid_test() {'{'}</div>
          <div className="pl-2 text-safety-orange sm:pl-4">droid --task "Run tests for $1"</div>
          <div>{'}'}</div>
          <br className="hidden sm:block" />
          <div className="text-pure-white">for file in tests:</div>
          <div className="pl-2 sm:pl-4">run_droid_test(file)</div>
          <div className="mt-2 flex justify-end sm:mt-4">
            <span className="rounded-[2px] bg-pure-white px-1.5 py-0.5 font-sans text-[8px] font-bold text-obsidian sm:text-[10px]">
              RUN
            </span>
          </div>
        </div>
      </motion.div>

      {/* Floating Code Terminal 2 */}
      <motion.div
        className="absolute bottom-[5%] right-0 z-20 w-[160px] overflow-hidden rounded border border-[#313150]/60 bg-[#0A0A0A]/90 font-mono text-[8px] shadow-2xl backdrop-blur-sm sm:right-2 sm:bottom-[12%] sm:w-[200px] sm:text-[9px] md:right-4 md:bottom-1/4 md:w-[260px] lg:right-8 lg:w-[300px] lg:text-xs"
        animate={{ y: [15, -15, 15], rotate: [0.5, -0.5, 0.5] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      >
        <div className="flex items-center gap-1 border-b border-[#313150]/60 bg-[#111111]/80 px-2 py-1.5 sm:gap-1.5 sm:px-3 sm:py-2">
          <div className="h-2 w-2 rounded-full bg-steel/30" />
          <div className="h-2 w-2 rounded-full bg-steel/30" />
          <div className="h-2 w-2 rounded-full bg-steel/30" />
          <span className="ml-1.5 text-steel/50 sm:ml-2">agent_fix.sh</span>
        </div>
        <div className="p-2 leading-relaxed text-steel sm:p-3 md:p-4">
          <div className="text-pure-white">run_droid_fix() {'{'}</div>
          <div className="pl-2 sm:pl-4">echo "Processing $1"</div>
          <div className="pl-2 text-safety-orange sm:pl-4">droid --task "Fix the bug in $1"</div>
          <div>{'}'}</div>
          <br className="hidden sm:block" />
          <div className="text-pure-white">for bug in bugs:</div>
          <div className="pl-2 sm:pl-4">run_droid_fix(bug)</div>
          <div className="mt-2 flex justify-end sm:mt-4">
            <span className="rounded-[2px] bg-pure-white px-1.5 py-0.5 font-sans text-[8px] font-bold text-obsidian sm:text-[10px]">
              RUN
            </span>
          </div>
        </div>
      </motion.div>

      {/* Interactive Metric Pill 1 */}
      <motion.div
        className="absolute right-[5%] top-[15%] z-20 flex items-center gap-1.5 rounded-full border border-[#313150]/60 bg-[#0A0A0A]/80 px-2 py-1.5 shadow-lg backdrop-blur-sm sm:right-[8%] sm:top-[18%] sm:gap-2 sm:px-3 sm:py-2 md:right-1/4 md:top-1/4"
        animate={{ x: [-8, 8, -8], y: [-5, 5, -5] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-4 rounded-full bg-steel/20" />
          <div className="h-1.5 w-1.5 rounded-full bg-steel/20" />
          <div className="relative h-1.5 w-10 overflow-hidden rounded-full bg-[#1A1A1A]">
            <motion.div
              className="absolute bottom-0 left-0 top-0 w-3 rounded-full bg-safety-orange drop-shadow-[0_0_4px_rgba(255,77,0,0.8)]"
              animate={{ x: ['0%', '300%', '0%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </div>
      </motion.div>

      {/* Interactive Metric Pill 2 */}
      <motion.div
        className="absolute bottom-[15%] left-[5%] z-20 flex items-center gap-1.5 rounded-full border border-[#313150]/60 bg-[#0A0A0A]/80 px-2 py-1.5 shadow-lg backdrop-blur-sm sm:bottom-[18%] sm:left-[8%] sm:gap-2 sm:px-3 sm:py-2 md:bottom-1/4 md:left-1/4"
        animate={{ x: [8, -8, 8], y: [5, -5, 5] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      >
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-steel/20" />
          <div className="h-1.5 w-3 rounded-full bg-steel/20" />
          <div className="relative h-1.5 w-8 overflow-hidden rounded-full bg-[#1A1A1A]">
            <motion.div
              className="absolute bottom-0 left-0 top-0 w-2 rounded-full bg-safety-orange drop-shadow-[0_0_4px_rgba(255,77,0,0.8)]"
              animate={{ x: ['0%', '300%', '0%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            />
          </div>
          <div className="h-1.5 w-1.5 rounded-full bg-safety-orange drop-shadow-[0_0_4px_rgba(255,77,0,0.8)]" />
        </div>
      </motion.div>
    </div>
  );
}
