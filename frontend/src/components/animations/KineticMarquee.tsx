'use client';

import { motion } from 'framer-motion';

const ITEMS = [
  "TYPESCRIPT", "PYTHON", "REACT", "NEXT.JS", "DJANGO", "FASTAPI", "NODE.JS", "POSTGRES", "REDIS", "AWS LAMBDA", "DYNAMODB"
];

export default function KineticMarquee() {
  return (
    <div className="relative flex overflow-x-hidden border-y border-[#1A1A1A] bg-[#050505] py-4 select-none">
      <div className="animate-marquee flex whitespace-nowrap">
        {/* Repeat the items multiple times to ensure smooth infinite scroll */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-12 px-6">
            {ITEMS.map((item, j) => (
              <div key={`${i}-${j}`} className="flex items-center gap-12">
                <span className="font-mono text-sm font-bold tracking-widest text-[#313150] hover:text-safety-orange hover:drop-shadow-[0_0_8px_rgba(255,77,0,0.8)] transition-all duration-300">
                  {item}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#1A1A1A]"></span>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      {/* Absolute overlay for fading edges */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-obsidian to-transparent z-10 pointer-events-none"></div>
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-obsidian to-transparent z-10 pointer-events-none"></div>
    </div>
  );
}
