'use client';

import Link from 'next/link';
import { Hexagon } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import Magnetic from '@/components/animations/Magnetic';

export default function Navigation() {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed top-0 left-0 right-0 z-50 bg-obsidian/80 backdrop-blur-md px-6 py-4"
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <div className="flex items-center gap-2">
          <Hexagon size={24} weight="fill" className="text-pure-white" />
          <span className="font-sans text-lg font-semibold tracking-tighter text-pure-white">
            Forge
          </span>
        </div>
        <div className="hidden items-center gap-8 md:flex">
          <Magnetic pull={0.1}>
            <Link href="#architecture" className="text-[12px] leading-[100%] tracking-[-0.015rem] uppercase font-mono text-steel transition-colors hover:text-pure-white px-2 py-1">
              Architecture
            </Link>
          </Magnetic>
          <Magnetic pull={0.1}>
            <Link href="#roadmap" className="text-[12px] leading-[100%] tracking-[-0.015rem] uppercase font-mono text-steel transition-colors hover:text-pure-white px-2 py-1">
              Roadmap
            </Link>
          </Magnetic>
          <Magnetic pull={0.1}>
            <Link href="#docs" className="text-[12px] leading-[100%] tracking-[-0.015rem] uppercase font-mono text-steel transition-colors hover:text-pure-white px-2 py-1">
              Docs
            </Link>
          </Magnetic>
          <Magnetic pull={0.2}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-pure-white px-4 py-2 font-mono text-[12px] leading-[100%] tracking-[-0.015rem] uppercase text-obsidian transition-colors hover:bg-safety-orange hover:text-pure-white hover:drop-shadow-[0_0_12px_rgba(255,77,0,0.5)]"
            >
              Get Started
            </motion.button>
          </Magnetic>
        </div>
      </div>
    </motion.nav>
  );
}
