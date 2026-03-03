import {
  Zap,
  BookOpen,
  ClipboardList,
  CalendarCheck,
  Shield,
  BarChart3,
  Terminal,
  Lock,
  Users,
  UserSearch,
  CalendarDays,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { useEffect, useState } from 'react';

function useResolvedTheme() {
  const { theme } = useTheme();
  const [resolved, setResolved] = useState<'dark' | 'light'>(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  });

  useEffect(() => {
    if (theme !== 'system') {
      setResolved(theme);
      return;
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setResolved(e.matches ? 'dark' : 'light');
    setResolved(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return resolved;
}

// Curated color palette — analogous pairs per row for visual harmony
const features = [
  {
    icon: Zap,
    title: 'Real-time Data Scraping',
    description: 'Instantly fetch the latest student data from Dicoding with one-click auto scraper.',
    gradient: 'from-amber-500 to-orange-500',
    visual: 'scraper' as const,
  },
  {
    icon: BookOpen,
    title: 'Course Progress Tracking',
    description: 'Monitor completion rates and individual learning journeys across all courses.',
    gradient: 'from-orange-500 to-rose-500',
    screenshot: 'course-progress',
  },
  {
    icon: ClipboardList,
    title: 'Assignment Overview',
    description: 'View submission status, grades, and deadlines across all cohort assignments.',
    gradient: 'from-rose-500 to-pink-500',
    screenshot: 'assignment-overview',
  },
  {
    icon: BarChart3,
    title: 'KPI Dashboard',
    description: 'At-a-glance performance metrics with interactive charts and summary cards.',
    gradient: 'from-violet-500 to-indigo-500',
    screenshot: 'kpi-dashboard',
  },
  {
    icon: CalendarCheck,
    title: 'Daily Check-in Analytics',
    description: 'Analyze student engagement patterns through mood and goal tracking insights.',
    gradient: 'from-indigo-500 to-blue-500',
    screenshot: 'daily-checkin',
  },
  {
    icon: Users,
    title: 'All Students View',
    description: 'Browse all students in an interactive table with profiles, status, and overall progress.',
    gradient: 'from-blue-500 to-cyan-500',
    screenshot: 'all-students',
  },
  {
    icon: UserSearch,
    title: 'Detailed Student View',
    description: 'Deep-dive into individual profiles — course progress, check-in history, and assignments.',
    gradient: 'from-teal-500 to-emerald-500',
    screenshot: 'detailed-student',
  },
  {
    icon: CalendarDays,
    title: 'Attendance Overview',
    description: 'Monitor daily attendance with a visual heatmap and comprehensive statistics.',
    gradient: 'from-emerald-500 to-green-500',
    screenshot: 'attendance-overview',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Credentials are never stored. All data processing happens securely on-demand.',
    gradient: 'from-green-500 to-teal-500',
    visual: 'secure' as const,
  },
];

function ScraperVisual({ isDark }: { isDark: boolean }) {
  return (
    <div className={`rounded-lg overflow-hidden border p-3 font-mono text-[10px] leading-relaxed space-y-1 ${isDark ? 'border-white/10 bg-[#0f1117]' : 'border-gray-200 bg-gray-50'}`}>
      <div className={`flex items-center gap-2 mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        <Terminal className="h-3 w-3" />
        <span>auto-scraper</span>
      </div>
      <p className="text-green-500">✓ Logging in to Dicoding...</p>
      <p className="text-green-500">✓ Fetching student list (25 students)</p>
      <p className="text-green-500">✓ Scraping course progress...</p>
      <p className="text-yellow-500 animate-pulse">⟳ Parsing assignments (18/25)</p>
      <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>
        <div className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 w-[72%] transition-all duration-1000" />
      </div>
    </div>
  );
}

function SecureVisual({ isDark }: { isDark: boolean }) {
  return (
    <div className={`rounded-lg overflow-hidden border p-4 flex flex-col items-center justify-center gap-3 ${isDark ? 'border-white/10 bg-[#0f1117]' : 'border-gray-200 bg-gray-50'}`}>
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-500/20 to-green-500/20 blur-xl" />
        <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-teal-500/10 to-green-500/10 border border-teal-500/30 flex items-center justify-center">
          <Lock className="h-5 w-5 text-teal-400" />
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {['No data stored', 'On-demand only', 'Encrypted'].map((tag) => (
          <span key={tag} className="px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-[10px] text-teal-500 font-medium">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function FeaturesSection() {
  const resolved = useResolvedTheme();
  const isDark = resolved === 'dark';

  return (
    <section id="features" className="relative py-28 px-6">
      {/* Section heading */}
      <div className="mx-auto max-w-3xl text-center mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
          Features
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Everything You Need to{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-pink-500">
            Manage Your Cohort
          </span>
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Powerful tools designed for facilitators to track, analyze, and support their students effectively.
        </p>
      </div>

      {/* Feature grid */}
      <div className="mx-auto max-w-6xl grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map(({ icon: Icon, title, description, gradient, screenshot, visual }) => (
          <div
            key={title}
            className="group relative rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 hover:bg-card/80 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-500"
          >
            {/* Glow on hover */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative space-y-3">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

              {/* Screenshot preview — natural height, no cropping */}
              {screenshot && (
                <div className={`rounded-lg overflow-hidden border ${isDark ? 'border-white/10 bg-[#0f1117]' : 'border-gray-200 bg-white'}`}>
                  <img
                    src={`/screenshots/${screenshot}${isDark ? '' : '-light'}.png`}
                    alt={`${title} preview`}
                    className="w-full h-auto block opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Custom visuals for cards without screenshots */}
              {visual === 'scraper' && <ScraperVisual isDark={isDark} />}
              {visual === 'secure' && <SecureVisual isDark={isDark} />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
