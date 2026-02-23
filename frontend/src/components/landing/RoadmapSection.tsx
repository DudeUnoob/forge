'use client';

import { useState } from 'react';
import { FadeInStagger, FadeInStaggerItem } from '@/components/animations/FadeInStagger';
import { TextScramble } from '@/components/animations/TextScramble';

function PhaseItem({ phase, delayIndex }: { phase: any, delayIndex: number }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <FadeInStaggerItem className="group relative flex flex-col md:flex-row md:items-center justify-between border-b border-[#313150] last:border-0 py-10 px-6 cursor-pointer overflow-hidden transition-colors hover:bg-[#11111A]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Scanline Effect */}
      <div className="absolute left-0 top-0 h-full w-full pointer-events-none overflow-hidden">
        <div className="absolute left-0 h-[2px] w-full bg-safety-orange opacity-0 mix-blend-screen -translate-y-full transition-none group-hover:opacity-30 group-hover:translate-y-[1000%] group-hover:duration-1000 group-hover:ease-linear"></div>
      </div>

      <div className="flex flex-col gap-3 relative z-10 w-full md:w-2/3">
        <span className="font-mono text-xs text-steel tracking-widest flex items-center gap-3">
          <span className="w-1.5 h-1.5 bg-steel/50 rounded-full group-hover:bg-safety-orange transition-colors"></span>
          <TextScramble text={phase.timeline} trigger="controlled" isHovered={isHovered} />
        </span>
        <h3 className="font-sans text-3xl md:text-4xl font-medium text-pure-white transition-all duration-0 group-hover:font-mono group-hover:font-bold group-hover:text-safety-orange group-hover:tracking-tighter">
          {phase.title}
        </h3>
        <p className="font-mono text-xs text-steel/70 leading-relaxed mt-2 hidden md:block opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {phase.details}
        </p>
      </div>
      
      <div className="mt-6 md:mt-0 font-mono text-sm text-steel flex flex-col md:items-end gap-2 relative z-10">
        <span className="transition-colors group-hover:text-pure-white px-2 py-1 bg-[#1A1A1A] rounded text-[10px] tracking-widest uppercase">
          {phase.status}
        </span>
        <span className="opacity-0 transition-none group-hover:opacity-100 text-safety-orange font-bold text-[10px]">
          <TextScramble text="[ EXECUTE ]" trigger="controlled" isHovered={isHovered} />
        </span>
      </div>
    </FadeInStaggerItem>
  );
}

export default function RoadmapSection() {
  const phases = [
    { 
      title: 'Repository Analysis & AST Parsing', 
      timeline: 'PHASE 1 (WEEKS 1-2)', 
      status: 'MVP COMPLETE',
      details: 'Building Lambda-based parsers using tree-sitter to extract modules, classes, and dependencies. Storing structural metadata in DynamoDB to form the system graph.'
    },
    { 
      title: 'AI Storyboard Generation', 
      timeline: 'PHASE 2 (WEEKS 3-4)', 
      status: 'MVP COMPLETE',
      details: 'Invoking Amazon Bedrock (Claude) to decompose AST graphs into ordered "lego blocks". Generating structured learning paths and caching architecture schemas.'
    },
    { 
      title: 'Interactive Walkthrough UI', 
      timeline: 'PHASE 3 (WEEKS 5-6)', 
      status: 'IN PROGRESS',
      details: 'Deploying React dashboard on AWS Kiro. Implementing block-scoped contextual AI chat using OpenSearch to prevent hallucinations across the repository.'
    },
    { 
      title: 'Role-Based Paths & Progress Tracking', 
      timeline: 'PHASE 4 (WEEKS 7-8)', 
      status: 'PLANNED',
      details: 'Creating distinct frontend/backend onboarding variations. Persisting developer comprehension metrics and completion states within DynamoDB.'
    },
  ];

  return (
    <section id="roadmap" className="bg-obsidian py-32 px-6 relative z-10 border-t border-[#1A1A1A]">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 mb-16">
          <span className="font-mono text-[10px] uppercase tracking-widest text-safety-orange font-bold">The Game Plan</span>
          <h2 className="font-sans text-4xl font-semibold tracking-tighter text-pure-white md:text-6xl">
            Deployment Phases
          </h2>
        </div>

        <FadeInStagger className="flex flex-col border-y border-[#313150]" staggerDelay={0.1}>
          {phases.map((phase, i) => (
            <PhaseItem key={i} phase={phase} delayIndex={i} />
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}