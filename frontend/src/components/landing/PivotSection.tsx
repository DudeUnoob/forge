'use client';

import { motion } from 'framer-motion';
import { FadeInStagger, FadeInStaggerItem } from '@/components/animations/FadeInStagger';

function VerticalSlider({ delay, height = "60%", activeColor = "dark", topDot = "black" }: { delay: number, height?: string, activeColor?: "dark" | "orange", topDot?: "black" | "grey" | "orange" }) {
  return (
    <div className="flex flex-col items-center gap-2 md:gap-2.5">
      {/* Top dot */}
      <div className={`w-[5px] h-[5px] md:w-[7px] md:h-[7px] rounded-full border border-transparent ${topDot === 'black' ? 'bg-[#020202]' :
        topDot === 'orange' ? 'bg-[#FF4D00] shadow-[0_0_8px_rgba(255,77,0,0.6)]' :
          topDot === 'grey' ? 'bg-[#C2C0BD]' : 'bg-transparent'
        }`}></div>

      {/* Track */}
      <div className="relative w-[18px] md:w-[20px] lg:w-[22px] h-[140px] md:h-[180px] lg:h-[220px] bg-[#EBEBEB] border border-[#DECFBE]/40 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] overflow-hidden rounded-full flex flex-col justify-end items-center mx-auto">
        {/* Background Dots */}
        <div className="absolute inset-x-0 top-3 bottom-3 md:top-5 md:bottom-5 flex flex-col justify-between items-center pointer-events-none z-0">
          <div className="w-[4px] h-[4px] md:w-[5px] md:h-[5px] rounded-full bg-[#C2C0BD]"></div>
          <div className="w-[4px] h-[4px] md:w-[5px] md:h-[5px] rounded-full bg-[#C2C0BD]"></div>
          <div className="w-[4px] h-[4px] md:w-[5px] md:h-[5px] rounded-full bg-[#C2C0BD]"></div>
          <div className="w-[4px] h-[4px] md:w-[5px] md:h-[5px] rounded-full bg-[#C2C0BD]"></div>
          <div className="w-[4px] h-[4px] md:w-[5px] md:h-[5px] rounded-full bg-[#C2C0BD]"></div>
        </div>

        {/* Active fill container (animates height) */}
        <motion.div
          className="w-full relative flex flex-col justify-start items-center pb-[4px] z-10"
          initial={{ height: '20%' }}
          animate={{ height: ['20%', height, '20%'] }}
          transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay }}
        >
          {/* Active fill pill (background) */}
          <div className={`absolute bottom-[3px] md:bottom-[4px] w-[12px] md:w-[14px] top-0 rounded-full ${activeColor === 'orange' ? 'bg-safety-orange' : 'bg-[#3D3A38]'}`}></div>

          {/* Thumb */}
          <div className="relative mt-[1px] w-[12px] h-[12px] md:w-[14px] md:h-[14px] rounded-full bg-safety-orange border-[2px] border-white shadow-sm flex items-center justify-center">
            {/* Small inner dot */}
            <div className="w-[3px] h-[3px] md:w-[4px] md:h-[4px] bg-white rounded-full"></div>
          </div>
        </motion.div>
      </div>

      {/* Bottom dot */}
      <div className="w-1.5 h-1.5 md:w-1.5 md:h-1.5 rounded-full border-[1.5px] border-[#C2C0BD] bg-transparent"></div>
    </div>
  )
}

function GrowingBarChart() {
  const bars = 26;
  return (
    <div className="w-full flex flex-col gap-6">
      {/* Bar Chart */}
      <div className="flex items-end justify-between w-full h-[100px] md:h-[130px] lg:h-[160px] px-1">
        {[...Array(bars)].map((_, i) => {
          const heightPercent = Math.pow(i / (bars - 1), 2.5) * 85 + 15;
          return (
            <motion.div
              key={i}
              className="w-[3px] md:w-[4px] lg:w-[6px] rounded-t-sm bg-safety-orange"
              initial={{ height: '0%' }}
              whileInView={{ height: `${heightPercent}%` }}
              viewport={{ once: true }}
              transition={{
                duration: 1.2,
                delay: i * 0.04,
                type: "spring",
                stiffness: 100,
                damping: 20
              }}
            />
          );
        })}
      </div>

      {/* Horizontal Slider */}
      <div className="w-full relative h-[18px] bg-[#EBEBEB] shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] border border-[#DECFBE]/40 rounded-full flex items-center px-[4px]">
        {/* Fill line */}
        <motion.div
          className="h-[10px] bg-[#C2C0BD] rounded-full relative flex items-center justify-end"
          initial={{ width: "10%" }}
          animate={{ width: ["10%", "95%", "10%"] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Thumb */}
          <div className="absolute -right-[7px] w-[16px] h-[16px] rounded-full bg-[#3D3A38] shadow-md flex items-center justify-center border-[2px] border-[#EBEBEB] z-10">
            <div className="w-[6px] h-[6px] bg-safety-orange rounded-full flex items-center justify-center">
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function PivotSection() {
  return (
    <section id="manifesto" className="min-h-[100dvh] w-full bg-dark-base-primary py-8 md:py-16 px-4 md:px-6 lg:px-8 relative z-10 overflow-hidden flex items-center justify-center">
      <div className="w-full max-w-[1400px] mx-auto bg-[#F8F8F8] rounded-xl sm:rounded-[20px] relative overflow-hidden flex flex-col justify-center min-h-[600px] lg:min-h-[700px] shadow-2xl border border-[#020202]">
        {/* Subtle diagonal background texture inside the card */}
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

        <div className="w-full h-full pt-8 pb-8 px-6 sm:px-8 md:pt-12 md:pb-12 md:px-10 lg:pt-16 lg:pb-16 lg:px-12 relative z-10 flex flex-col">
          <FadeInStagger className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr] flex-1 min-h-full" staggerDelay={0.15}>

            {/* Column 1 */}
            <FadeInStaggerItem className="flex flex-col justify-between col-span-1 border-b border-[#020202] pb-8 mb-8 md:border-b-0 md:mb-0 md:pb-0 relative z-10 md:pr-8 lg:pr-12">
              <div>
                <div className="flex items-center gap-3 mb-8 md:mb-12">
                  <div className="w-1.5 h-1.5 rounded-full bg-safety-orange"></div>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-[#020202]">Enterprise</span>
                </div>
                <p className="text-pretty font-mono text-[16px] xl:text-[18px] leading-[1.35] md:leading-[1.4] tracking-[-0.02em] text-[#020202] max-w-[34ch]">
                  Forge is designed to scale with your engineering team—transforming tribal knowledge into interactive storyboards that integrate seamlessly into your workflow.
                </p>
              </div>

              <h2 className="font-sans font-normal text-[42px] leading-[1.05] tracking-[-0.03em] lg:-ml-1 lg:text-[52px] xl:text-[56px] 2xl:text-[64px] text-balance text-[#020202] mt-16 md:mt-0 mb-[-5px]">
                AI that will work with you, not replace you
              </h2>
            </FadeInStaggerItem>

            {/* Column 2 */}
            <FadeInStaggerItem className="flex flex-col justify-between col-span-1 border-b border-[#020202] pb-10 mb-8 md:border-b-0 md:mb-0 md:border-l md:px-8 lg:px-10 md:pb-0 relative z-10">
              <div>
                <h3 className="font-mono text-[14px] uppercase tracking-widest text-[#2E2C2B] mb-8 md:mb-12">Pedagogy-First Design</h3>
                <h4 className="font-sans font-normal text-[18px] leading-[100%] tracking-[-0.02rem] text-[#2E2C2B] mb-4">Eliminate the vibe coding crisis</h4>
                <p className="text-pretty font-mono text-[16px] leading-[1.35] xl:leading-[1.4] tracking-[-0.02em] text-[#5C5855] mb-8 lg:max-w-[32ch]">
                  Forge forces intentional learning of why systems work, not just how to use them. Reduce onboarding time by 50% while capturing architectural intent natively.
                </p>
                <a href="#" className="font-mono text-[12px] uppercase tracking-[0.05em] text-[#020202] hover:text-safety-orange transition-colors mt-auto inline-block leading-[1.6]">
                  LEARN MORE ABOUT <br className="hidden lg:block xl:hidden" /> STORYBOARDS <span className="tracking-normal">-{'>'}</span>
                </a>
              </div>

              <div className="mt-16 flex justify-between items-end w-full lg:max-w-[300px]">
                <VerticalSlider delay={0} height="30%" activeColor="dark" topDot="black" />
                <VerticalSlider delay={0.4} height="80%" activeColor="orange" topDot="grey" />
                <VerticalSlider delay={0.8} height="50%" activeColor="dark" topDot="orange" />
                <VerticalSlider delay={1.2} height="65%" activeColor="dark" topDot="black" />
                <VerticalSlider delay={1.6} height="90%" activeColor="orange" topDot="orange" />
                <VerticalSlider delay={2.0} height="25%" activeColor="dark" topDot="black" />
                <VerticalSlider delay={2.4} height="60%" activeColor="dark" topDot="black" />
              </div>
            </FadeInStaggerItem>

            {/* Column 3 */}
            <FadeInStaggerItem className="flex flex-col justify-between col-span-1 border-t-0 md:border-l border-[#020202] pl-0 md:pl-8 lg:pl-10 pb-0 relative z-10">
              <div>
                <h3 className="font-mono text-[14px] uppercase tracking-widest text-[#2E2C2B] mb-8 md:mb-12">Across Your Development Stack</h3>
                <h4 className="font-sans font-normal text-[18px] leading-[100%] tracking-[-0.02rem] text-[#2E2C2B] mb-4">Role-based learning paths</h4>
                <p className="text-pretty font-mono text-[16px] leading-[1.35] xl:leading-[1.4] tracking-[-0.02em] text-[#5C5855] mb-8 lg:max-w-[32ch]">
                  Whether you are frontend, backend, or infra—Forge tailors the storyboard to skip irrelevant internals and focus on the architecture that matters most to your role.
                </p>
                <a href="#" className="font-mono text-[12px] uppercase tracking-[0.05em] text-[#020202] hover:text-safety-orange transition-colors mt-auto inline-block leading-[1.6]">
                  EXPLORE LEARNING PATHS <span className="tracking-normal">-{'>'}</span>
                </a>
              </div>

              <div className="mt-16 w-full max-w-[340px]">
                <GrowingBarChart />
              </div>
            </FadeInStaggerItem>

          </FadeInStagger>
        </div>
      </div>
    </section>
  );
}