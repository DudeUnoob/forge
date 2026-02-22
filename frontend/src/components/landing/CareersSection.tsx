'use client';

import { useState } from 'react';
import { FadeInStagger, FadeInStaggerItem } from '@/components/animations/FadeInStagger';
import { TextScramble } from '@/components/animations/TextScramble';

function RoleItem({ role, delayIndex }: { role: any, delayIndex: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <FadeInStaggerItem className="group relative flex flex-col md:flex-row md:items-center justify-between border-b border-[#313150] last:border-0 py-10 px-6 cursor-pointer overflow-hidden transition-colors hover:bg-[#11111A]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Scanline Effect using Framer/CSS animation logic approach */}
      <div className="absolute left-0 top-0 h-full w-full pointer-events-none overflow-hidden">
        <div className="absolute left-0 h-[2px] w-full bg-safety-orange opacity-0 mix-blend-screen -translate-y-full transition-none group-hover:opacity-30 group-hover:translate-y-[1000%] group-hover:duration-1000 group-hover:ease-linear"></div>
      </div>

      <div className="flex flex-col gap-3 relative z-10">
        <span className="font-mono text-xs text-steel tracking-widest">
          <TextScramble text={role.dept} trigger="controlled" isHovered={isHovered} />
        </span>
        <h3 className="font-sans text-3xl md:text-5xl font-medium text-pure-white transition-all duration-0 group-hover:font-mono group-hover:font-bold group-hover:text-safety-orange group-hover:tracking-tighter">
          {role.title}
        </h3>
      </div>
      
      <div className="mt-6 md:mt-0 font-mono text-sm text-steel flex items-center gap-6 relative z-10">
        <span className="transition-colors group-hover:text-pure-white">{role.loc}</span>
        <span className="opacity-0 transition-none group-hover:opacity-100 text-safety-orange font-bold">
          <TextScramble text="[ INIT ]" trigger="controlled" isHovered={isHovered} />
        </span>
      </div>
    </FadeInStaggerItem>
  );
}

export default function CareersSection() {
  const roles = [
    { title: 'Senior AI Engineer', dept: 'KNOWLEDGE SYSTEMS', loc: 'SAN FRANCISCO' },
    { title: 'Lead Frontend Architect', dept: 'STORYBOARD UI', loc: 'REMOTE' },
    { title: 'Staff Learning Scientist', dept: 'RESEARCH', loc: 'NEW YORK' },
    { title: 'Developer Advocate', dept: 'DEV REL', loc: 'LONDON' },
  ];

  return (
    <section id="careers" className="bg-obsidian py-32 px-6 relative z-10 border-t border-[#1A1A1A]">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-16 font-sans text-4xl font-semibold tracking-tighter text-pure-white md:text-6xl">
          The Registry
        </h2>

        <FadeInStagger className="flex flex-col border-y border-[#313150]" staggerDelay={0.1}>
          {roles.map((role, i) => (
            <RoleItem key={i} role={role} delayIndex={i} />
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}
