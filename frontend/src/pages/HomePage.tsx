import LandingNavbar from '@/components/landing/LandingNavbar';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import LoginSection from '@/components/landing/LoginSection';
import FooterSection from '@/components/landing/FooterSection';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden transition-colors duration-500">
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
      <LoginSection />
      <FooterSection />
    </div>
  );
};

export default HomePage;
