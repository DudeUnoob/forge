'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export default function PivotSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    if (!sectionRef.current || !barsRef.current || !pathRef.current) return;

    if (titleRef.current) {
      gsap.fromTo(titleRef.current, 
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: sectionRef.current, start: 'top 60%' } }
      );
    }

    const bars = barsRef.current.children;
    gsap.fromTo(
      bars,
      { scaleY: 0 },
      {
        scaleY: 1,
        stagger: 0.1,
        ease: 'power4.out',
        duration: 1,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
        },
      }
    );

    const length = pathRef.current.getTotalLength();
    gsap.set(pathRef.current, { strokeDasharray: length, strokeDashoffset: length });
    gsap.to(pathRef.current, {
      strokeDashoffset: 0,
      ease: 'power4.out',
      duration: 2,
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 70%',
      },
    });

  }, []);

  return (
    <section ref={sectionRef} id="manifesto" className="min-h-[100dvh] bg-pure-white py-32 px-6 relative z-10">
      <div className="mx-auto max-w-7xl">
        <h2 ref={titleRef} className="mb-24 max-w-5xl font-sans text-5xl font-bold tracking-tighter text-obsidian md:text-7xl lg:text-8xl">
          Onboard faster. <br/> Understand deeper.
        </h2>

        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-24">
          {/* Left: Onboarding Time Reduction Bars */}
          <div className="flex flex-col gap-8">
            <h3 className="font-mono text-sm font-semibold uppercase tracking-widest text-steel">Time to First PR</h3>
            <div ref={barsRef} className="flex h-[300px] items-end gap-4 border-b border-steel/30 pb-4">
              <div className="w-full bg-steel/30 origin-bottom transition-colors" style={{ height: '90%' }}></div>
              <div className="w-full bg-steel/30 origin-bottom transition-colors" style={{ height: '85%' }}></div>
              <div className="w-full bg-steel/30 origin-bottom transition-colors" style={{ height: '80%' }}></div>
              <div className="w-full bg-safety-orange origin-bottom" style={{ height: '30%' }}></div>
              <div className="w-full bg-safety-orange/80 origin-bottom" style={{ height: '25%' }}></div>
              <div className="w-full bg-safety-orange/60 origin-bottom" style={{ height: '20%' }}></div>
            </div>
            <div className="flex justify-between font-mono text-xs text-steel px-2">
              <span>Traditional Onboarding (Weeks)</span>
              <span className="text-safety-orange font-bold">Forge Onboarding (Days)</span>
            </div>
          </div>

          {/* Right: Comprehension Tracking Curve */}
          <div className="flex flex-col gap-8">
            <h3 className="font-mono text-sm font-semibold uppercase tracking-widest text-steel">System Comprehension</h3>
            <div className="relative h-[300px] w-full border-l border-b border-steel/30">
              <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  ref={pathRef}
                  d="M 0 20 C 20 20, 30 40, 50 60 C 70 80, 80 90, 100 100"
                  fill="none"
                  stroke="#FF4D00"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              {/* Grid lines */}
              <div className="absolute top-1/4 w-full border-t border-dashed border-steel/20"></div>
              <div className="absolute top-2/4 w-full border-t border-dashed border-steel/20"></div>
              <div className="absolute top-3/4 w-full border-t border-dashed border-steel/20"></div>
            </div>
             <div className="flex justify-between font-mono text-xs text-steel mt-2">
              <span>DAY 1</span>
              <span>INDEPENDENCE</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
