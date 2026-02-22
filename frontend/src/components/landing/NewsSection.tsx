import { FadeInStagger, FadeInStaggerItem } from '@/components/animations/FadeInStagger';

export default function NewsSection() {
  const news = [
    { id: 1, date: 'FEB_2026', title: 'Forge secures Series A to scale knowledge transfer.' },
    { id: 2, date: 'JAN_2026', title: 'Introducing Role Paths: Onboarding tailored to your stack.' },
    { id: 3, date: 'DEC_2025', title: 'The Pedagogy-First Era: Why "vibe coding" isn\'t enough.' },
    { id: 4, date: 'NOV_2025', title: 'Forge 2.0: Interactive Storyboards meet hardware acceleration.' },
  ];

  return (
    <section id="news" className="bg-obsidian py-32 px-6 relative z-10">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-16 font-sans text-4xl font-semibold tracking-tighter text-pure-white md:text-6xl">
          The Ledger
        </h2>

        <FadeInStagger className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#313150] border border-[#313150]" staggerDelay={0.15}>
          {news.map((item) => (
            <FadeInStaggerItem key={item.id} className="group relative bg-[#0A0A0A] p-10 min-h-[300px] flex flex-col justify-between overflow-hidden cursor-pointer">
              {/* Gradient border hover effect */}
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" 
                   style={{
                     background: 'radial-gradient(circle at 100% 100%, rgba(255,77,0,0.15) 0%, transparent 60%)'
                   }}>
              </div>
              {/* Top border highlight */}
              <div className="absolute top-0 right-0 h-[2px] w-0 bg-safety-orange transition-all duration-500 ease-out group-hover:w-full"></div>
              {/* Right border highlight */}
              <div className="absolute top-0 right-0 h-0 w-[2px] bg-safety-orange transition-all duration-500 ease-out group-hover:h-full"></div>

              <span className="font-mono text-sm font-bold text-steel tracking-widest relative z-10">
                {item.date}
              </span>
              <h3 className="font-sans text-2xl md:text-3xl font-medium text-pure-white leading-tight relative z-10 transition-colors group-hover:text-safety-orange">
                {item.title}
              </h3>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}
