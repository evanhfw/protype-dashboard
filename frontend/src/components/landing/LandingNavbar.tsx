import { useState, useEffect } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-primary/5'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <a href="/home" className="flex items-center gap-2 group">
          <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25 group-hover:shadow-primary/40 transition-shadow">
            <span className="text-white font-bold text-sm">dC</span>
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
            diCodex
          </span>
        </a>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollTo('features')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group"
          >
            Features
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
          </button>
          <button
            onClick={() => scrollTo('about')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group"
          >
            About
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all group-hover:w-full" />
          </button>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => scrollTo('login')}
            className="hidden md:inline-flex items-center px-5 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300"
          >
            Sign In
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            <span className={`w-5 h-0.5 bg-foreground transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`w-5 h-0.5 bg-foreground transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`w-5 h-0.5 bg-foreground transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          mobileOpen ? 'max-h-60 border-b border-border/50' : 'max-h-0'
        } bg-background/95 backdrop-blur-xl`}
      >
        <div className="px-6 py-4 flex flex-col gap-3">
          <button onClick={() => scrollTo('features')} className="text-sm text-left text-muted-foreground hover:text-foreground py-2">
            Features
          </button>
          <button onClick={() => scrollTo('about')} className="text-sm text-left text-muted-foreground hover:text-foreground py-2">
            About
          </button>
          <button
            onClick={() => scrollTo('login')}
            className="mt-1 text-center px-5 py-2.5 rounded-full text-sm font-medium bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg"
          >
            Sign In
          </button>
        </div>
      </div>
    </nav>
  );
}
