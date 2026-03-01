import { useState, useEffect } from 'react';
import { Activity, TrendingUp, Users } from 'lucide-react';

const API_URL = '';
const API_KEY = import.meta.env.VITE_API_KEY || '';

interface ScrapingStats {
  today: Record<string, number>;
  total_completed: number;
}

const COHORT_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  CFC: { label: 'CFC', color: 'text-blue-400', bgColor: 'from-blue-500 to-cyan-500' },
  CDC: { label: 'CDC', color: 'text-green-400', bgColor: 'from-green-500 to-emerald-500' },
  CAC: { label: 'CAC', color: 'text-primary', bgColor: 'from-primary to-pink-500' },
};

export default function StatsSection() {
  const [stats, setStats] = useState<ScrapingStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const headers: Record<string, string> = {};
        if (API_KEY) headers['X-API-Key'] = API_KEY;

        const res = await fetch(`${API_URL}/api/stats/scraping`, { headers });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (e) {
        console.error('Failed to load stats:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const todayTotal = stats
    ? Object.values(stats.today).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <section className="relative py-20 px-6">
      {/* Section heading */}
      <div className="mx-auto max-w-3xl text-center mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
          <Activity className="h-3.5 w-3.5" />
          Live Statistics
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Facilitator{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-pink-500">
            Scraping Activity
          </span>
        </h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Real-time overview of data scraping across all cohort types today.
        </p>
      </div>

      <div className="mx-auto max-w-4xl">
        {loading ? (
          /* Skeleton loader */
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-border/40 bg-card/50 p-6 animate-pulse">
                <div className="h-4 w-16 bg-muted rounded mb-3" />
                <div className="h-8 w-12 bg-muted rounded mb-2" />
                <div className="h-3 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Cohort cards */}
            {Object.entries(COHORT_CONFIG).map(([key, cfg]) => {
              const count = stats?.today[key] || 0;
              return (
                <div
                  key={key}
                  className="group relative rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 hover:bg-card/80 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-500"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${cfg.bgColor} flex items-center justify-center shadow-lg`}>
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground">{cfg.label}</span>
                    </div>
                    <p className={`text-3xl font-extrabold ${cfg.color}`}>
                      {count}
                    </p>
                    <p className="text-xs text-muted-foreground">scrapes today</p>
                  </div>
                </div>
              );
            })}

            {/* Total card */}
            <div className="group relative rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 hover:bg-card/80 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-500">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">Total</span>
                </div>
                <p className="text-3xl font-extrabold text-violet-400">
                  {stats?.total_completed || 0}
                </p>
                <p className="text-xs text-muted-foreground">all-time scrapes</p>
              </div>
            </div>
          </div>
        )}

        {/* Today summary */}
        {!loading && (
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{todayTotal}</span> facilitator{todayTotal !== 1 ? 's' : ''} scraped today
              {stats?.today && Object.keys(stats.today).filter(k => !['CAC', 'CDC', 'CFC'].includes(k)).length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground/70">
                  (+ {Object.entries(stats.today).filter(([k]) => !['CAC', 'CDC', 'CFC'].includes(k)).map(([k, v]) => `${k}: ${v}`).join(', ')})
                </span>
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
