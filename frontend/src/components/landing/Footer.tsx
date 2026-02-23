import { Hexagon } from '@phosphor-icons/react/dist/ssr';

export default function Footer() {
  return (
    <footer className="bg-dark-base-primary py-24 px-6 relative z-10">
      <div className="mx-auto max-w-7xl flex flex-col md:flex-row justify-between gap-16">

        {/* Left: System Health */}
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <Hexagon size={32} weight="fill" className="text-pure-white" />
            <span className="font-sans text-2xl font-bold tracking-tighter text-pure-white">Forge</span>
          </div>

          <div className="flex flex-col gap-3 font-mono text-sm tracking-widest text-steel mt-4">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-safety-orange animate-pulse drop-shadow-[0_0_4px_rgba(255,77,0,0.8)]"></span>
              <span>NETWORK: <span className="text-[#a6e3a1]">OPTIMAL</span></span>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-safety-orange animate-pulse drop-shadow-[0_0_4px_rgba(255,77,0,0.8)]"></span>
              <span>AGENTS: <span className="text-[#a6e3a1]">ONLINE</span></span>
            </div>
          </div>
        </div>

        {/* Right: Sitemap */}
        <div className="flex flex-col gap-5 font-mono text-xs uppercase tracking-widest md:ml-auto">
          <div className="flex flex-col gap-5">
            <span className="text-pure-white font-bold">Platform</span>
            <a href="#features" className="text-steel hover:text-safety-orange transition-none">Storyboards</a>
            <a href="#roadmap" className="text-steel hover:text-safety-orange transition-none">Role Paths</a>
            <a href="#architecture" className="text-steel hover:text-safety-orange transition-none">Integrations</a>
          </div>
          <div className="hidden">
            <span className="text-pure-white font-bold">Company</span>
            <a href="#architecture" className="text-steel hover:text-safety-orange transition-none">Architecture</a>
            <a href="#roadmap" className="text-steel hover:text-safety-orange transition-none">Roadmap</a>
            <a href="#manifesto" className="text-steel hover:text-safety-orange transition-none">Manifesto</a>
          </div>
          <div className="hidden">
            <span className="text-pure-white font-bold">Legal</span>
            <a href="#" className="text-steel hover:text-safety-orange transition-none">Privacy</a>
            <a href="#" className="text-steel hover:text-safety-orange transition-none">Terms</a>
            <a href="#" className="text-steel hover:text-safety-orange transition-none">Security</a>
          </div>
        </div>

      </div>
    </footer>
  );
}
