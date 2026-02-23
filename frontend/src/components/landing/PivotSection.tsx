'use client';

import { motion } from 'framer-motion';
import { FadeInStagger, FadeInStaggerItem } from '@/components/animations/FadeInStagger';

function VerticalSlider({ delay, height = "60%", highlight = false, dotTop = false, dotBottom = false }: { delay: number, height?: string, highlight?: boolean, dotTop?: boolean, dotBottom?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Top dot */}
      <div className={`w-1.5 h-1.5 rounded-full ${dotTop ? (highlight ? 'bg-safety-orange drop-shadow-[0_0_4px_rgba(255,77,0,0.5)]' : 'bg-obsidian') : 'bg-transparent'}`}></div>
      
      <div className="relative w-4 h-32 bg-steel/20 rounded-full flex flex-col justify-end items-center">
        <motion.div 
          className={`w-full rounded-full ${highlight ? 'bg-safety-orange drop-shadow-[0_0_6px_rgba(255,77,0,0.3)]' : 'bg-steel/40'} relative flex flex-col justify-start items-center`}
          initial={{ height: '10%' }}
          animate={{ height: ['10%', height, '10%'] }}
          transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay }}
        >
           <div className={`w-3.5 h-3.5 rounded-full bg-pure-white border-[2.5px] absolute -top-1.5 shadow-sm ${highlight ? 'border-safety-orange' : 'border-steel/60'}`}></div>
        </motion.div>
      </div>
      
      {/* Bottom dot */}
      <div className={`w-1.5 h-1.5 rounded-full ${dotBottom ? 'border border-steel/50' : 'bg-transparent'}`}></div>
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
      <div className="w-full relative h-3 bg-steel/20 rounded-full flex items-center px-1">
        <motion.div 
          className="h-1.5 bg-safety-orange rounded-full relative"
          initial={{ width: "20%" }}
          animate={{ width: ["20%", "80%", "20%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-obsidian border-[2px] border-safety-orange shadow-[0_0_8px_rgba(255,77,0,0.4)] flex items-center justify-center">
             <div className="w-1 h-1 bg-pure-white rounded-full"></div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function PivotSection() {
  return (
    <section id="manifesto" className="min-h-[100dvh] w-full bg-[#f9fafb] py-24 px-6 relative z-10 overflow-hidden flex items-center justify-center">
      {/* Subtle diagonal background texture matching reference */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="diagonal-stripes" width="10" height="10" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="10" stroke="#000000" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#diagonal-stripes)" />
        </svg>
      </div>

      <div className="w-full max-w-7xl mx-auto h-full flex flex-col justify-center">
        <FadeInStagger className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16 h-full min-h-[600px]" staggerDelay={0.15}>
          
          {/* Column 1 */}
          <FadeInStaggerItem className="flex flex-col justify-between col-span-1 h-full relative z-10 py-4">
            <div>
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-2 h-2 rounded-full bg-steel/60"></div>
                 <span className="font-mono text-[10px] uppercase tracking-widest text-obsidian font-bold">Enterprise</span>
              </div>
              <p className="font-mono text-[13px] text-obsidian/80 leading-relaxed max-w-[34ch]">
                Forge is designed to scale with your engineering team—transforming tribal knowledge into interactive storyboards that integrate seamlessly into your workflow.
              </p>
            </div>

            <h2 className="font-sans text-5xl md:text-6xl font-medium tracking-tighter text-obsidian leading-[1.05] mt-16 md:mt-0">
              AI that will work with you, not replace you
            </h2>
          </FadeInStaggerItem>

          {/* Column 2 */}
          <FadeInStaggerItem className="flex flex-col justify-between col-span-1 border-t border-[#1A1A1A]/10 md:border-t-0 md:border-l pl-0 md:pl-8 lg:pl-12 py-4 relative z-10">
            <div>
              <div className="w-full h-px bg-[#1A1A1A]/10 mb-6 hidden md:block"></div>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-obsidian font-bold mb-8">Pedagogy-First Design</h3>
              <h4 className="font-sans text-xl font-medium text-obsidian tracking-tight mb-4">Eliminate the vibe coding crisis</h4>
              <p className="font-mono text-[12px] text-steel leading-relaxed mb-6 max-w-[32ch]">
                Forge forces intentional learning of why systems work, not just how to use them. Reduce onboarding time by 50% while capturing architectural intent natively.
              </p>
              <a href="#" className="font-mono text-[10px] uppercase tracking-widest text-obsidian font-bold hover:text-safety-orange transition-colors flex items-center gap-2">
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
          <FadeInStaggerItem className="flex flex-col justify-between col-span-1 border-t border-[#1A1A1A]/10 md:border-t-0 md:border-l pl-0 md:pl-8 lg:pl-12 py-4 relative z-10">
            <div>
              <div className="w-full h-px bg-[#1A1A1A]/10 mb-6 hidden md:block"></div>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-obsidian font-bold mb-8">Across Your Development Stack</h3>
              <h4 className="font-sans text-xl font-medium text-obsidian tracking-tight mb-4">Role-based learning paths</h4>
              <p className="font-mono text-[12px] text-steel leading-relaxed mb-6 max-w-[32ch]">
                Whether you are frontend, backend, or infra—Forge tailors the storyboard to skip irrelevant internals and focus on the architecture that matters most to your role.
              </p>
              <a href="#" className="font-mono text-[10px] uppercase tracking-widest text-obsidian font-bold hover:text-safety-orange transition-colors flex items-center gap-2">
                Explore Learning Paths &rarr;
              </a>
            </div>

            <div className="mt-16 w-full max-w-[320px]">
               <GrowingBarChart />
            </div>
          </FadeInStaggerItem>

        </FadeInStagger>
      </div>
    </section>
  );
}