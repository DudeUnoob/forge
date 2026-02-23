'use client';

import { motion } from 'framer-motion';
import { FadeInStagger, FadeInStaggerItem } from '@/components/animations/FadeInStagger';

const AWS_SERVICES = [
  {
    id: 'bedrock',
    title: 'Amazon Bedrock',
    description: 'Powers semantic analysis, contextual storyboard generation, and strictly scoped AI chat using Claude 3.5 Sonnet.',
    tag: 'INTELLIGENCE',
    animation: (
      <div className="flex gap-1.5 h-12 items-end">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="w-1.5 bg-safety-orange/80 rounded-t-sm"
            animate={{ height: ['20%', '100%', '20%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
          />
        ))}
      </div>
    ),
    span: 'md:col-span-2',
  },
  {
    id: 'lambda',
    title: 'AWS Lambda',
    description: 'Serverless execution for AST parsing with tree-sitter, on-demand storyboard generation, and API routing.',
    tag: 'COMPUTE',
    animation: (
      <div className="flex gap-2 items-center h-12">
        <div className="w-2 h-2 rounded-full bg-steel/30" />
        <div className="h-0.5 w-8 bg-steel/20 relative overflow-hidden">
          <motion.div 
            className="absolute top-0 left-0 h-full w-full bg-safety-orange"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <div className="w-2 h-2 rounded-full bg-safety-orange drop-shadow-[0_0_6px_rgba(255,77,0,0.8)]" />
      </div>
    ),
    span: 'md:col-span-1',
  },
  {
    id: 'dynamodb',
    title: 'Amazon DynamoDB',
    description: 'Ultra-low latency storage for parsed AST metadata, generated storyboards, and user comprehension progress.',
    tag: 'STATE',
    animation: (
      <div className="flex flex-col gap-1 h-12 justify-center">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-1">
            <motion.div 
              className="h-1.5 w-1.5 bg-steel/30 rounded-sm"
              animate={{ backgroundColor: ['#3F3F46', '#FF4D00', '#3F3F46'] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            />
            <div className="h-1.5 w-12 bg-steel/10 rounded-sm" />
          </div>
        ))}
      </div>
    ),
    span: 'md:col-span-1',
  },
  {
    id: 's3',
    title: 'Amazon S3',
    description: 'Durable object storage caching repository snapshots and visually generated SVG architecture diagrams.',
    tag: 'STORAGE',
    animation: (
      <div className="relative h-12 w-12 flex items-center justify-center border border-steel/20 rounded-md">
        <motion.div 
          className="absolute inset-1 border border-safety-orange/50 rounded-sm"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
        <div className="w-2 h-2 bg-pure-white rounded-full" />
      </div>
    ),
    span: 'md:col-span-2',
  }
];

export default function ArchitectureSection() {
  return (
    <section id="architecture" className="bg-obsidian py-32 px-6 relative z-10 border-t border-[#1A1A1A]">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 mb-16">
          <span className="font-mono text-[10px] uppercase tracking-widest text-safety-orange font-bold">The Infrastructure</span>
          <h2 className="font-sans text-4xl font-semibold tracking-tighter text-pure-white md:text-6xl">
            AWS Native Architecture
          </h2>
        </div>

        <FadeInStagger className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#313150] border border-[#313150] rounded-xl overflow-hidden" staggerDelay={0.15}>
          {AWS_SERVICES.map((service) => (
            <FadeInStaggerItem 
              key={service.id} 
              className={`group relative bg-[#0A0A0A] p-8 min-h-[280px] flex flex-col justify-between overflow-hidden cursor-pointer ${service.span}`}
            >
              {/* Refraction edge */}
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />
              
              {/* Gradient border hover effect */}
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" 
                   style={{ background: 'radial-gradient(circle at 100% 100%, rgba(255,77,0,0.1) 0%, transparent 60%)' }}>
              </div>

              {/* Top border highlight */}
              <div className="absolute top-0 left-0 h-[1px] w-0 bg-safety-orange transition-all duration-500 ease-out group-hover:w-full"></div>

              <div className="flex justify-between items-start relative z-10">
                <span className="font-mono text-[10px] font-bold text-steel tracking-widest px-2 py-1 bg-steel/10 rounded">
                  {service.tag}
                </span>
                <div className="opacity-50 group-hover:opacity-100 transition-opacity duration-300">
                  {service.animation}
                </div>
              </div>

              <div className="relative z-10 mt-12">
                <h3 className="font-sans text-2xl font-medium text-pure-white mb-3 tracking-tight">
                  {service.title}
                </h3>
                <p className="font-mono text-xs text-steel/80 leading-relaxed max-w-[90%]">
                  {service.description}
                </p>
              </div>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}