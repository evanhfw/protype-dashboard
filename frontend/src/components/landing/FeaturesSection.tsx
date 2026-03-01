import { Zap, BookOpen, ClipboardList, CalendarCheck, Shield, BarChart3, Terminal, Lock } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Real-time Data Scraping',
    description: 'Instantly fetch the latest student data from Dicoding with one-click auto scraper.',
    gradient: 'from-yellow-500 to-orange-500',
    visual: 'scraper',
  },
  {
    icon: BookOpen,
    title: 'Course Progress Tracking',
    description: 'Monitor completion rates and individual learning journeys across all courses.',
    gradient: 'from-blue-500 to-cyan-500',
    screenshot: '/screenshots/course-progress.png',
  },
  {
    icon: ClipboardList,
    title: 'Assignment Overview',
    description: 'View submission status, grades, and deadlines across all cohort assignments.',
    gradient: 'from-primary to-pink-500',
    screenshot: '/screenshots/assignment-overview.png',
  },
  {
    icon: CalendarCheck,
    title: 'Daily Check-in Analytics',
    description: 'Analyze student engagement patterns through mood and goal tracking insights.',
    gradient: 'from-green-500 to-emerald-500',
    screenshot: '/screenshots/daily-checkin.png',
  },
  {
    icon: BarChart3,
    title: 'KPI Dashboard',
    description: 'At-a-glance performance metrics with interactive charts and summary cards.',
    gradient: 'from-violet-500 to-purple-500',
    screenshot: '/screenshots/kpi-dashboard.png',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Credentials are never stored. All data processing happens securely on-demand.',
    gradient: 'from-rose-500 to-red-500',
    visual: 'secure',
  },
];

function ScraperVisual() {
  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-white/10 bg-[#0f1117] p-3 font-mono text-[10px] leading-relaxed space-y-1">
      <div className="flex items-center gap-2 text-gray-500 mb-2">
        <Terminal className="h-3 w-3" />
        <span>auto-scraper</span>
      </div>
      <p className="text-green-400">✓ Logging in to Dicoding...</p>
      <p className="text-green-400">✓ Fetching student list (25 students)</p>
      <p className="text-green-400">✓ Scraping course progress...</p>
      <p className="text-yellow-400 animate-pulse">⟳ Parsing assignments (18/25)</p>
      <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 w-[72%] transition-all duration-1000" />
      </div>
    </div>
  );
}

function SecureVisual() {
  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-white/10 bg-[#0f1117] p-4 flex flex-col items-center gap-3">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-rose-500/20 to-red-500/20 blur-xl" />
        <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-rose-500/10 to-red-500/10 border border-rose-500/30 flex items-center justify-center">
          <Lock className="h-5 w-5 text-rose-400" />
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {['No data stored', 'On-demand only', 'Encrypted'].map((tag) => (
          <span key={tag} className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 font-medium">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function FeaturesSection() {
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

            <div className="relative space-y-4">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>

              {/* Screenshot preview — forced dark container */}
              {screenshot && (
                <div className="mt-3 rounded-lg overflow-hidden border border-white/10 bg-[#0f1117]">
                  <img
                    src={screenshot}
                    alt={`${title} preview`}
                    className="w-full h-auto block opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Custom visuals for cards without screenshots */}
              {visual === 'scraper' && <ScraperVisual />}
              {visual === 'secure' && <SecureVisual />}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
