import GridOverlay from '@/components/landing/GridOverlay';
import Navigation from '@/components/landing/Navigation';
import HeroSection from '@/components/landing/HeroSection';
import KineticMarquee from '@/components/animations/KineticMarquee';
import ShowcaseSection from '@/components/landing/ShowcaseSection';
import PivotSection from '@/components/landing/PivotSection';
import NewsSection from '@/components/landing/NewsSection';
import CareersSection from '@/components/landing/CareersSection';
import Footer from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <main className="landing-page relative bg-obsidian text-steel font-sans antialiased">
      <GridOverlay />
      <Navigation />
      <HeroSection />
      <KineticMarquee />
      <ShowcaseSection />
      <PivotSection />
      <NewsSection />
      <CareersSection />
      <Footer />
    </main>
  );
}
