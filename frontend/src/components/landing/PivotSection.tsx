'use client';

import { motion } from 'framer-motion';
import { FadeInStagger, FadeInStaggerItem } from '@/components/animations/FadeInStagger';

function VerticalSlider({ delay, height = "60%", highlight = false, dotTop = false, dotBottom = false }: { delay: number, height?: string, highlight?: boolean, dotTop?: boolean, dotBottom?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Top dot */}
      <div className={`w-1.5 h-1.5 rounded-full ${dotTop ? (highlight ? 'bg-safety-orange drop-shadow-[0_0_4px_rgba(255,77,0,0.5)]' : 'bg-obsidian') : 'bg-transparent'}`}></div>

      <div className="relative w-[18px] h-32 bg-obsidian/5 border border-obsidian/10 rounded-full flex flex-col justify-end items-center mx-auto mb-1">
        <motion.div
          className={`w-full rounded-full ${highlight ? 'bg-obsidian/80' : 'bg-steel/30'} relative flex flex-col justify-start items-center`}
          initial={{ height: '10%' }}
          animate={{ height: ['10%', height, '10%'] }}
          transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay }}
        >
          <div className={`w-[14px] h-[14px] rounded-full absolute -top-[7px] shadow-sm border-[3px] border-pure-white ${highlight ? 'bg-safety-orange' : 'bg-steel/50'}`}></div>
        </motion.div>
      </div>

      {/* Bottom dot */}
      <div className={`w-1.5 h-1.5 rounded-full ${dotBottom ? 'border border-obsidian/30' : 'bg-transparent'}`}></div>
    </div>
  )
}

function GrowingBarChart() {
  const bars = 24;
  return (
    <div className="w-full flex flex-col gap-4">
      {/* Bar Chart */}
      <div className="flex items-end justify-between w-full h-24 px-2">
        {[...Array(bars)].map((_, i) => {
          const isOrange = i < 14;
          const heightPercent = Math.pow(i / (bars - 1), 2) * 80 + 20; // Exponential growth
          return (
            <motion.div
              key={i}
              className={`w-1.5 rounded-t-sm ${isOrange ? 'bg-safety-orange' : 'bg-steel/30'}`}
              initial={{ height: '0%' }}
              whileInView={{ height: `${heightPercent}%` }}
              transition={{ duration: 1, delay: i * 0.05, ease: "easeOut" }}
              viewport={{ once: true }}
            />
          );
        })}
      </div>

      {/* Horizontal Slider */}
      <div className="w-full relative h-[14px] bg-obsidian/5 border border-obsidian/10 rounded-full flex items-center px-1">
        <motion.div
          className="h-1.5 bg-obsidian/20 rounded-full relative"
          initial={{ width: "20%" }}
          animate={{ width: ["20%", "80%", "20%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-obsidian border-[2px] border-pure-white shadow-sm flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-safety-orange rounded-full"></div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function PivotSection() {
  return (
    <section id="manifesto" className="min-h-[100dvh] w-full bg-dark-base-primary py-16 md:py-24 px-4 sm:px-6 lg:px-8 relative z-10 overflow-hidden flex items-center justify-center">
      <div className="w-full max-w-[1400px] mx-auto bg-[#F8F8F8] rounded-xl sm:rounded-[20px] relative overflow-hidden flex flex-col justify-center min-h-[600px] lg:min-h-[700px] shadow-2xl">
        {/* Subtle diagonal background texture inside the card */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="diagonal-stripes" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="10" stroke="#000000" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#diagonal-stripes)" />
          </svg>
        </div>

        <div className="w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 relative z-10 flex flex-col">
          <FadeInStagger className="grid grid-cols-1 md:grid-cols-3 gap-0 h-full flex-1" staggerDelay={0.15}>

            {/* Column 1 */}
            <FadeInStaggerItem className="flex flex-col justify-between col-span-1 h-full relative z-10 pb-4 md:pr-8 lg:pr-12">
              <div>
                <div className="flex items-center gap-3 mb-8 md:mb-12">
                  <div className="w-1.5 h-1.5 rounded-full bg-safety-orange"></div>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-obsidian/70">Enterprise</span>
                </div>
                <p className="text-pretty font-mono text-[18px] leading-[1.6] md:leading-[1.7] text-[#020202] max-w-[34ch]">
                  Forge is designed to scale with your engineering team—transforming tribal knowledge into interactive storyboards that integrate seamlessly into your workflow.
                </p>
              </div>

              <h2 className="font-sans font-normal text-[40px] leading-[1.05] tracking-tight md:tracking-[-0.04em] lg:-ml-1 lg:text-5xl 2xl:text-[56px] text-balance text-obsidian mt-16 md:mt-0 pb-2">
                AI that will work with you, not replace you
              </h2>
            </FadeInStaggerItem>

            {/* Column 2 */}
            <FadeInStaggerItem className="flex flex-col justify-between col-span-1 border-t border-obsidian/20 md:border-t-0 md:border-l pl-0 md:pl-8 lg:pl-12 pb-4 relative z-10">
              <div>
                <h3 className="font-mono text-[14px] uppercase tracking-widest text-[#2E2C2B] mb-8 md:mb-12">Pedagogy-First Design</h3>
                <h4 className="font-sans font-normal text-[20px] leading-[100%] tracking-[-0.02rem] lg:text-[24px] text-obsidian mb-4">Eliminate the vibe coding crisis</h4>
                <p className="text-pretty font-mono text-[14px] leading-[1.6] md:leading-[1.7] lg:text-[15px] text-obsidian/70 mb-8 max-w-[32ch]">
                  Forge forces intentional learning of why systems work, not just how to use them. Reduce onboarding time by 50% while capturing architectural intent natively.
                </p>
                <a href="#" className="font-mono text-[11px] uppercase tracking-wider text-obsidian/70 hover:text-safety-orange transition-colors flex items-center gap-2">
                  Learn more about Storyboards &rarr;
                </a>
              </div>

              <div className="mt-16 flex justify-between items-end w-full max-w-[280px]">
                <VerticalSlider delay={0} height="30%" dotBottom />
                <VerticalSlider delay={0.4} height="80%" dotTop />
                <VerticalSlider delay={0.8} height="50%" highlight dotBottom dotTop />
                <VerticalSlider delay={1.2} height="40%" dotTop />
                <VerticalSlider delay={1.6} height="90%" highlight dotBottom />
                <VerticalSlider delay={2.0} height="20%" dotBottom />
                <VerticalSlider delay={2.4} height="60%" highlight dotTop />
              </div>
            </FadeInStaggerItem>

            {/* Column 3 */}
            <FadeInStaggerItem className="flex flex-col justify-between col-span-1 border-t border-obsidian/20 md:border-t-0 md:border-l pl-0 md:pl-8 lg:pl-12 pb-4 relative z-10">
              <div>
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-obsidian/70 mb-8 md:mb-12">Across Your Development Stack</h3>
                <h4 className="font-sans font-normal text-[20px] leading-[100%] tracking-[-0.02rem] lg:text-[24px] text-obsidian mb-4">Role-based learning paths</h4>
                <p className="text-pretty font-mono text-[14px] leading-[1.6] md:leading-[1.7] lg:text-[15px] text-obsidian/70 mb-8 max-w-[32ch]">
                  Whether you are frontend, backend, or infra—Forge tailors the storyboard to skip irrelevant internals and focus on the architecture that matters most to your role.
                </p>
                <a href="#" className="font-mono text-[11px] uppercase tracking-wider text-obsidian/70 hover:text-safety-orange transition-colors flex items-center gap-2">
                  Explore Learning Paths &rarr;
                </a>
              </div>

              <div className="mt-16 w-full max-w-[320px]">
                <GrowingBarChart />
              </div>
            </FadeInStaggerItem>

          </FadeInStagger>
        </div>
      </div>
    </section >
  );
}