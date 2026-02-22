'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const CHARS = '!<>-_\\/[]{}—=+*^?#________';

export function TextScramble({ 
  text, 
  trigger = 'hover',
  isHovered = false,
  className = '' 
}: { 
  text: string;
  trigger?: 'hover' | 'always' | 'controlled';
  isHovered?: boolean;
  className?: string;
}) {
  const [displayText, setDisplayText] = useState(text);
  const [localHover, setLocalHover] = useState(false);

  const hoverState = trigger === 'controlled' ? isHovered : localHover;

  useEffect(() => {
    if ((trigger === 'hover' || trigger === 'controlled') && !hoverState) {
      setDisplayText(text);
      return;
    }

    let iteration = 0;
    let interval: NodeJS.Timeout;

    const startScramble = () => {
      clearInterval(interval);
      interval = setInterval(() => {
        setDisplayText((prev) => 
          prev.split('')
            .map((char, index) => {
              if (index < iteration) {
                return text[index];
              }
              return CHARS[Math.floor(Math.random() * CHARS.length)];
            })
            .join('')
        );
        
        if (iteration >= text.length) {
          clearInterval(interval);
        }
        
        iteration += 1 / 3; // Controls speed of unscrambling
      }, 30);
    };

    startScramble();

    return () => clearInterval(interval);
  }, [text, hoverState, trigger]);

  return (
    <motion.span 
      onMouseEnter={() => setLocalHover(true)}
      onMouseLeave={() => setLocalHover(false)}
      className={className}
    >
      {displayText}
    </motion.span>
  );
}
