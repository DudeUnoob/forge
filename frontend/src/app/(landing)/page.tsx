import GridOverlay from '@/components/landing/GridOverlay';
import Navigation from '@/components/landing/Navigation';
import HeroSection from '@/components/landing/HeroSection';
import KineticMarquee from '@/components/animations/KineticMarquee';
import ShowcaseSection from '@/components/landing/ShowcaseSection';
import PivotSection from '@/components/landing/PivotSection';
import ArchitectureSection from '@/components/landing/ArchitectureSection';
import RoadmapSection from '@/components/landing/RoadmapSection';
import Footer from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <main className="relative bg-obsidian text-steel">
      <GridOverlay />
      <Navigation />
      <HeroSection />
      <KineticMarquee />
      <ShowcaseSection />
      <PivotSection />
      <ArchitectureSection />
      <RoadmapSection />
      <Footer />
    </main>
  );
}
