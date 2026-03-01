import { BarChart3, TrendingUp, Users } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="landing-gradient-orb landing-gradient-orb-1" />
        <div className="landing-gradient-orb landing-gradient-orb-2" />
        <div className="landing-gradient-orb landing-gradient-orb-3" />

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-20 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Text content */}
        <div className="space-y-8 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative rounded-full h-2 w-2 bg-primary" />
            </span>
            Education Analytics Platform
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-foreground/70">
              Track Your Cohort's
            </span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-pink-500">
              Progress
            </span>{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground/80 to-foreground/50">
              Like Never Before
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 leading-relaxed">
            An intuitive analytics dashboard providing deep insights into student engagement,
            course completion, and cohort performance — all in real-time.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <a
              href="#login"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full text-sm font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300"
            >
              Get Started
            </a>
            <a
              href="#features"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full text-sm font-semibold border border-border/60 text-foreground hover:bg-accent hover:border-accent-foreground/20 hover:-translate-y-0.5 transition-all duration-300"
            >
              Learn More
            </a>
          </div>
        </div>

        {/* Dashboard preview illustration */}
        <div className="relative flex justify-center lg:justify-end">
          <div className="relative w-full max-w-md lg:max-w-lg">
            {/* Glow behind card */}
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/20 via-pink-500/10 to-primary/5 blur-2xl opacity-60 landing-float" />

            {/* Main card */}
            <div className="relative rounded-2xl border border-border/40 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Top bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                  <div className="w-3 h-3 rounded-full bg-green-400/70" />
                </div>
                <span className="text-xs text-muted-foreground ml-2 font-medium">diCodex — Dashboard</span>
              </div>

              {/* Dashboard mockup content */}
              <div className="p-5 space-y-4">
                {/* KPI Row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Users, label: 'Students', value: '24', color: 'from-blue-500 to-cyan-500' },
                    { icon: TrendingUp, label: 'Progress', value: '88%', color: 'from-primary to-pink-500' },
                    { icon: BarChart3, label: 'Completed', value: '245', color: 'from-green-500 to-emerald-500' },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="rounded-xl bg-muted/60 p-3 space-y-1.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <p className={`text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r ${color}`}>
                        {value}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Chart bars */}
                <div className="rounded-xl bg-muted/40 p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Course Progress</p>
                  {[85, 72, 65, 90, 45].map((val, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] text-muted-foreground w-16 truncate">Course {i + 1}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-1000"
                          style={{ width: `${val}%`, animationDelay: `${i * 200}ms` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">{val}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-3 -right-3 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-xs font-medium text-green-400 flex items-center gap-1.5 shadow-lg landing-float-delayed">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              Live Data
            </div>
            <div className="absolute -bottom-2 -left-3 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-xs font-medium text-primary flex items-center gap-1.5 shadow-lg landing-float">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Auto Scrape
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-xs text-muted-foreground">Scroll</span>
        <div className="w-5 h-8 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-1.5">
          <div className="w-1 h-2 rounded-full bg-muted-foreground/50" />
        </div>
      </div>
    </section>
  );
}
