import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useStudentData } from '@/contexts/StudentDataContext';
import { Loader2, Shield, CheckCircle2, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import type { AttendanceStatus, ParsedStudentStatus, CheckinMood, CheckinGoal } from '@/data/parsedData';

/* ── types ─────────────────────────────────────────────── */
interface ProgressPayload {
  percent: number;
  message: string;
  current_step: number;
  total_steps: number;
  updated_at?: string | null;
}
interface JobResult {
  success?: boolean;
  error?: string;
  error_type?: string;
  file?: string;
  students?: number;
}
interface JobStatusPayload {
  job_id: string;
  status: string;
  running: boolean;
  message?: string;
  queue_position?: number;
  progress?: ProgressPayload;
  result?: JobResult | null;
}
type JsonMap = Record<string, unknown>;
const asList = (value: unknown): JsonMap[] =>
  Array.isArray(value) ? (value as JsonMap[]) : [];

const API_URL = '';
const API_KEY = import.meta.env.VITE_API_KEY || '';
const MAX_POLL_ATTEMPTS = 60;

function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (API_KEY) headers['X-API-Key'] = API_KEY;
  return headers;
}

/* ── component ─────────────────────────────────────────── */
export default function LoginSection() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const { toast } = useToast();
  const { setStudentData } = useStudentData();
  const navigate = useNavigate();

  /* ── scrape logic (mirrors CredentialsForm) ─── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Missing credentials', description: 'Please enter both email and password', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/scrape`, {
        method: 'POST',
        headers: apiHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Scraping failed');
      }
      const result = await response.json();
      const jobId: string = result.job_id;
      toast({ title: 'Scraping started!', description: 'Data collection usually takes around 1 minute.' });
      setPassword('');
      setProgress(5);
      setStatusMessage('Initializing scraper...');
      const streamConnected = await streamScraperStatus(jobId);
      if (!streamConnected) pollScraperStatus(jobId);
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to start scraping', variant: 'destructive' });
      setIsLoading(false);
    }
  };

  const updateLoadingState = (status: JobStatusPayload, attempts: number) => {
    if (status.running) {
      if (status.queue_position) {
        setProgress(0);
        setStatusMessage(`Waiting in queue (Position: ${status.queue_position})...`);
      } else if (status.progress) {
        setProgress(status.progress.percent);
        setStatusMessage(status.progress.message);
      } else {
        const est = Math.min(10 + attempts * 1.5, 95);
        setProgress(est);
        if (status.status === 'queued') setStatusMessage('Waiting in queue...');
        else if (est < 20) setStatusMessage('Logging in to Dicoding...');
        else if (est < 40) setStatusMessage('Loading student list...');
        else if (est < 60) setStatusMessage('Extracting student data...');
        else if (est < 80) setStatusMessage('Processing student details...');
        else setStatusMessage('Finalizing data collection...');
      }
    }
  };

  const handleTerminalResult = (result?: JobResult | null) => {
    if (!result) {
      setIsLoading(false); setProgress(0); setStatusMessage('');
      toast({ title: 'Scraping failed', description: 'Job finished without result', variant: 'destructive' });
      return;
    }
    setProgress(100); setStatusMessage('Complete!');
    setTimeout(() => {
      setIsLoading(false);
      if (result.success) {
        fetchAndSaveData(result.file || '', result.students || 0);
      } else if (result.error_type === 'invalid_credentials') {
        toast({ title: 'Invalid Credentials', description: 'The email or password is incorrect.', variant: 'destructive' });
        setProgress(0); setStatusMessage('');
      } else {
        toast({ title: 'Scraping failed', description: result.error || 'Unknown error', variant: 'destructive' });
        setProgress(0); setStatusMessage('');
      }
    }, 300);
  };

  const parseSseEvent = (rawEvent: string): { event: string; data: JobStatusPayload | null } | null => {
    const lines = rawEvent.split('\n');
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return null;
    try { return { event, data: JSON.parse(dataLines.join('')) as JobStatusPayload }; }
    catch { return null; }
  };

  const streamScraperStatus = async (jobId: string): Promise<boolean> => {
    let sawTerminal = false;
    try {
      const response = await fetch(`${API_URL}/api/scrape/stream/${jobId}`, { method: 'GET', headers: apiHeaders() });
      if (!response.ok || !response.body) return false;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const rawEvent of events) {
          const parsed = parseSseEvent(rawEvent);
          if (!parsed?.data) continue;
          if (parsed.event === 'heartbeat') continue;
          updateLoadingState(parsed.data, 0);
          if (!parsed.data.running && (parsed.data.result || parsed.data.status === 'not_found')) {
            sawTerminal = true; handleTerminalResult(parsed.data.result); await reader.cancel(); return true;
          }
          if (parsed.event === 'error' && parsed.data.result) {
            sawTerminal = true; handleTerminalResult(parsed.data.result); await reader.cancel(); return true;
          }
        }
      }
      return sawTerminal;
    } catch { return false; }
  };

  const pollScraperStatus = async (jobId: string) => {
    let attempts = 0;
    const poll = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/scrape/status/${jobId}`, { headers: apiHeaders() });
        const status = (await response.json()) as JobStatusPayload;
        updateLoadingState(status, attempts);
        if (!status.running && (status.result || status.status === 'not_found')) {
          clearInterval(poll); handleTerminalResult(status.result); return;
        }
        attempts += 1;
        if (attempts >= MAX_POLL_ATTEMPTS) {
          clearInterval(poll); setIsLoading(false); setProgress(0); setStatusMessage('');
          toast({ title: 'Timeout', description: 'Scraping is taking longer than expected.', variant: 'destructive' });
        }
      } catch (error) { console.error('Polling error:', error); }
    }, 5000);
  };

  const fetchAndSaveData = async (_filename: string, studentCount: number) => {
    try {
      const response = await fetch(`${API_URL}/api/students`, { headers: apiHeaders() });
      if (!response.ok) throw new Error('Failed to fetch student data');
      const data = await response.json();
      const parsedStudents = asList((data as JsonMap).students).map((s) => {
        const profile = (s.profile as JsonMap) || undefined;
        const progress = (s.progress as JsonMap) || undefined;
        const assignmentsFromProgress = progress ? (((progress.assignments as JsonMap)?.items as unknown) ?? []) : [];
        return {
          name: String(s.name || ''),
          status: (s.status as ParsedStudentStatus | null) ?? null,
          courses: asList(s.courses).map((c) => ({
            name: String(c.name || c.course || ''),
            progress: String(c.progress || c.progress_percent || '0%'),
            status: c.status === 'Completed' ? ('Completed' as const)
              : c.status === 'In Progress' ? ('In Progress' as const)
              : ('Not Started' as const),
          })),
          assignments: asList(s.assignments || assignmentsFromProgress).map((a) => ({
            name: String(a.name || a.assignment || ''),
            status: a.status === 'Completed' ? ('Completed' as const)
              : a.status === 'Late' ? ('Late' as const)
              : a.status === 'Resubmit' ? ('Resubmit' as const)
              : ('Uncompleted' as const),
          })),
          dailyCheckins: asList(s.daily_checkins).map((ci) => ({
            date: String(ci.date || ''),
            mood: String(ci.mood || 'neutral') as CheckinMood,
            goals: asList(ci.goals).map((g) => ({ title: String(g.title || ''), items: (g.items as string[]) || [] })) as CheckinGoal[],
            reflection: String(ci.reflection || ''),
          })),
          pointHistories: asList(s.point_histories).map((ph) => ({
            date: String(ph.date || ''), description: String(ph.description || ''),
            points: Number(ph.points || 0),
          })),
          attendances: asList(s.attendances || (progress?.attendances as JsonMap)?.items).map((att) => ({
            event: String(att.event || ''),
            status: String(att.status || '') as AttendanceStatus,
          })),
          imageUrl: String((profile?.photo_url as string) || s.imageUrl || ''),
          profile: profile ? {
            university: String(profile.university || ''),
            major: String(profile.major || ''),
            photoUrl: String(profile.photo_url || ''),
            profileLink: String(profile.profile_link || ''),
          } : undefined,
        };
      });
      const rawMentor = data.metadata?.mentor || data.mentor;
      const mentorInfo = rawMentor ? { group: rawMentor.group || '', mentorCode: rawMentor.mentor_code || '', name: rawMentor.name || '' } : undefined;
      setStudentData(parsedStudents, mentorInfo);
      toast({ title: 'Scraping complete!', description: `Successfully scraped ${studentCount} students. Redirecting...` });
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (error) {
      setIsLoading(false); setProgress(0); setStatusMessage('');
      toast({ title: 'Error loading data', description: error instanceof Error ? error.message : 'Failed to load scraped data', variant: 'destructive' });
    }
  };

  /* ── render ─────────────────────────────────────── */
  return (
    <section id="login" className="relative py-28 px-6">
      {/* Background accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-md space-y-8">
        {/* Section heading */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
            Sign In
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-pink-500">
              Welcome Back
            </span>
          </h2>
          <p className="text-muted-foreground">
            Sign in to access your cohort dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="relative group">
          {/* Glow border effect */}
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/50 via-pink-500/30 to-primary/50 opacity-60 blur-sm group-hover:opacity-80 transition-opacity duration-500" />

          <div className="relative rounded-2xl border border-border/40 bg-card/90 backdrop-blur-xl p-8 shadow-2xl space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="landing-email" className="text-sm font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="landing-email"
                    type="email"
                    placeholder="you@student.devacademy.id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    className="pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="landing-password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="landing-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="pl-10 pr-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Progress */}
              {isLoading && (
                <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/30">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      {progress === 100 ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-green-500">{statusMessage}</span>
                        </>
                      ) : (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span>{statusMessage}</span>
                        </>
                      )}
                    </span>
                    <span className="text-muted-foreground">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    Usually takes around 1 minute. Please don&apos;t close this page.
                  </p>
                </div>
              )}

              {/* Security notice */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/20 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                Your credentials are sent securely and never stored
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all duration-300"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scraping in progress...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
