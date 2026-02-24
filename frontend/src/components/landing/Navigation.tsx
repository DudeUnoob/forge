'use client';

import Link from 'next/link';
import { Hexagon } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import Magnetic from '@/components/animations/Magnetic';

export default function Navigation() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 md:border-b-0 lg:px-9 bg-[#020202] backdrop-blur-md">
      <div className="mx-auto flex items-center justify-between py-5 max-w-[1400px]">
        {/* Logo Section */}
        <a href="/" className="z-50 flex items-center gap-2">
          <Hexagon size={24} weight="fill" className="text-pure-white" />
          <span className="font-sans text-xl font-medium tracking-[-0.04em] text-pure-white">
            Forge
          </span>
        </a>

        {/* Navigation Links & Buttons */}
        <nav className="z-50 flex w-full items-center justify-between gap-9 md:w-auto md:justify-end">
          {/* Desktop Links */}
          <div className="relative hidden lg:flex">
            <ul className="group/menu flex space-x-8">
              <li className="relative opacity-100 transition-opacity duration-250 group-hover/menu:opacity-60 hover:!opacity-100">
                <Magnetic pull={0.1}>
                  <Link
                    href="#architecture"
                    className="text-pretty font-mono text-[12px] leading-[100%] tracking-[-0.015rem] uppercase relative flex w-fit items-center transition-colors duration-200 hover:text-safety-orange group after:absolute after:-bottom-px after:left-0 after:h-px after:w-0 after:bg-current after:transition-all after:duration-300 after:ease-in-out hover:after:w-full text-steel"
                  >
                    Architecture
                  </Link>
                </Magnetic>
              </li>
              <li className="relative opacity-100 transition-opacity duration-250 group-hover/menu:opacity-60 hover:!opacity-100">
                <Magnetic pull={0.1}>
                  <Link
                    href="#roadmap"
                    className="text-pretty font-mono text-[12px] leading-[100%] tracking-[-0.015rem] uppercase relative flex w-fit items-center transition-colors duration-200 hover:text-safety-orange group after:absolute after:-bottom-px after:left-0 after:h-px after:w-0 after:bg-current after:transition-all after:duration-300 after:ease-in-out hover:after:w-full text-steel"
                  >
                    Roadmap
                  </Link>
                </Magnetic>
              </li>
              <li className="relative opacity-100 transition-opacity duration-250 group-hover/menu:opacity-60 hover:!opacity-100">
                <Magnetic pull={0.1}>
                  <Link
                    href="#docs"
                    className="text-pretty font-mono text-[12px] leading-[100%] tracking-[-0.015rem] uppercase relative flex w-fit items-center transition-colors duration-200 hover:text-safety-orange group after:absolute after:-bottom-px after:left-0 after:h-px after:w-0 after:bg-current after:transition-all after:duration-300 after:ease-in-out hover:after:w-full text-steel"
                  >
                    Docs
                  </Link>
                </Magnetic>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Magnetic pull={0.1}>
              <Link
                href="#get-started"
                className="group relative w-max cursor-pointer items-center justify-center border transition-colors duration-150 will-change-transform bg-pure-white hover:bg-dark-base-secondary focus-visible:bg-dark-base-secondary text-dark-base-secondary hover:text-pure-white focus-visible:text-pure-white hover:border-neutral-800 focus-visible:border-neutral-800 overflow-clip rounded-sm border-transparent h-[25px] px-3 hidden md:flex"
              >
                <span className="relative z-10 flex items-center uppercase">
                  <p className="text-pretty font-mono text-[12px] leading-[100%] tracking-[-0.015rem] uppercase">Get Started</p>
                </span>
                <div className="pointer-events-none absolute inset-0 opacity-0 will-change-transform group-hover:animate-[delayedFadeIn_100ms_ease-out_forwards]">
                  <div
                    className="group-hover:running absolute inset-0 animate-[slidePattern_2000ms_linear_infinite] opacity-100"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent 0px, transparent 2px, var(--neutral-800) 2px, var(--neutral-800) 3px, transparent 3px, transparent 5px)',
                      backgroundSize: '7.07px 7.07px'
                    }}
                  />
                </div>
              </Link>
            </Magnetic>

            {/* Mobile Menu Button - Using raw SVG path from Factory AI */}
            <button className="relative -m-1 flex cursor-pointer items-center justify-center p-1 text-steel hover:text-pure-white lg:hidden" aria-label="open/close mobile menu">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6H21V8H3V6Z" fill="currentColor"></path>
                <path d="M3 11H21V13H3V11Z" fill="currentColor"></path>
                <path d="M3 16H21V18H3V16Z" fill="currentColor"></path>
              </svg>
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
