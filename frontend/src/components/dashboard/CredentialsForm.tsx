import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useStudentData } from '@/contexts/StudentDataContext';
import { Loader2, Shield, CheckCircle2 } from 'lucide-react';
import type { AttendanceStatus } from '@/data/parsedData';

interface CredentialsFormProps {
  onScrapeSuccess?: () => void;
}

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

const asList = (value: unknown): JsonMap[] => (Array.isArray(value) ? (value as JsonMap[]) : []);

const API_URL = '';
const API_KEY = import.meta.env.VITE_API_KEY || '';
const MAX_POLL_ATTEMPTS = 60;

function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  return headers;
}

export const CredentialsForm = ({ onScrapeSuccess }: CredentialsFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const { toast } = useToast();
  const { setStudentData } = useStudentData();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: 'Missing credentials',
        description: 'Please enter both email and password',
        variant: 'destructive',
      });
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

      toast({
        title: 'Scraping started!',
        description: 'Data collection usually takes around 1 minute, depending on cohort size.',
      });

      setPassword('');
      setProgress(5);
      setStatusMessage('Initializing scraper...');

      const streamConnected = await streamScraperStatus(jobId);
      if (!streamConnected) {
        pollScraperStatus(jobId);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start scraping',
        variant: 'destructive',
      });
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
        const estimatedProgress = Math.min(10 + attempts * 1.5, 95);
        setProgress(estimatedProgress);

        if (status.status === 'queued') {
          setStatusMessage('Waiting in queue...');
        } else if (estimatedProgress < 20) {
          setStatusMessage('Logging in to Dicoding...');
        } else if (estimatedProgress < 40) {
          setStatusMessage('Loading student list...');
        } else if (estimatedProgress < 60) {
          setStatusMessage('Extracting student data...');
        } else if (estimatedProgress < 80) {
          setStatusMessage('Processing student details...');
        } else {
          setStatusMessage('Finalizing data collection...');
        }
      }
    }
  };

  const handleTerminalResult = (result?: JobResult | null) => {
    if (!result) {
      setIsLoading(false);
      setProgress(0);
      setStatusMessage('');
      toast({
        title: 'Scraping failed',
        description: 'Job finished without result',
        variant: 'destructive',
      });
      return;
    }

    setProgress(100);
    setStatusMessage('Complete!');

    setTimeout(() => {
      setIsLoading(false);

      if (result.success) {
        fetchAndSaveData(result.file || '', result.students || 0);
      } else if (result.error_type === 'invalid_credentials') {
        toast({
          title: 'Invalid Credentials',
          description: 'The email or password you entered is incorrect. Please check and try again.',
          variant: 'destructive',
        });
        setProgress(0);
        setStatusMessage('');
      } else {
        toast({
          title: 'Scraping failed',
          description: result.error || 'Unknown error',
          variant: 'destructive',
        });
        setProgress(0);
        setStatusMessage('');
      }
    }, 300);
  };

  const parseSseEvent = (rawEvent: string): { event: string; data: JobStatusPayload | null } | null => {
    const lines = rawEvent.split('\n');
    let event = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (dataLines.length === 0) {
      return null;
    }

    try {
      return {
        event,
        data: JSON.parse(dataLines.join('')) as JobStatusPayload,
      };
    } catch {
      return null;
    }
  };

  const streamScraperStatus = async (jobId: string): Promise<boolean> => {
    let sawTerminalEvent = false;

    try {
      const response = await fetch(`${API_URL}/api/scrape/stream/${jobId}`, {
        method: 'GET',
        headers: apiHeaders(),
      });

      if (!response.ok || !response.body) {
        return false;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          const parsed = parseSseEvent(rawEvent);
          if (!parsed || !parsed.data) {
            continue;
          }

          const payload = parsed.data;

          if (parsed.event === 'heartbeat') {
            continue;
          }

          updateLoadingState(payload, 0);

          if (!payload.running && (payload.result || payload.status === 'not_found')) {
            sawTerminalEvent = true;
            handleTerminalResult(payload.result);
            await reader.cancel();
            return true;
          }

          if (parsed.event === 'error' && payload.result) {
            sawTerminalEvent = true;
            handleTerminalResult(payload.result);
            await reader.cancel();
            return true;
          }
        }
      }

      return sawTerminalEvent;
    } catch (error) {
      console.error('SSE stream failed, fallback to polling:', error);
      return false;
    }
  };

  const pollScraperStatus = async (jobId: string) => {
    let attempts = 0;

    const poll = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/api/scrape/status/${jobId}`, {
          headers: apiHeaders(),
        });

        const status = (await response.json()) as JobStatusPayload;
        updateLoadingState(status, attempts);

        if (!status.running && (status.result || status.status === 'not_found')) {
          clearInterval(poll);
          handleTerminalResult(status.result);
          return;
        }

        attempts += 1;
        if (attempts >= MAX_POLL_ATTEMPTS) {
          clearInterval(poll);
          setIsLoading(false);
          setProgress(0);
          setStatusMessage('');
          toast({
            title: 'Timeout',
            description: 'Scraping is taking longer than expected. Please check status manually.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000);
  };

  const fetchAndSaveData = async (_filename: string, studentCount: number) => {
    try {
      const response = await fetch(`${API_URL}/api/students`, {
        headers: apiHeaders(),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch student data');
      }

      const data = await response.json();

      const parsedStudents = asList((data as JsonMap).students).map((s) => {
        const profile = (s.profile as JsonMap) || undefined;
        const progress = (s.progress as JsonMap) || undefined;
        const assignmentsFromProgress = progress
          ? (((progress.assignments as JsonMap)?.items as unknown) ?? [])
          : [];

        return {
          name: String(s.name || ''),
          status: (s.status as string | null) ?? null,
          courses: asList(s.courses),
          assignments: asList(s.assignments || assignmentsFromProgress).map((a) => ({
            name: String(a.name || a.assignment || ''),
            status: a.status === 'Completed' ? ('Completed' as const)
              : a.status === 'Late' ? ('Late' as const)
              : ('Uncompleted' as const),
          })),
          dailyCheckins: asList(s.daily_checkins).map((ci) => ({
            date: String(ci.date || ''),
            mood: String(ci.mood || ''),
            goals: asList(ci.goals),
            reflection: String(ci.reflection || ''),
          })),
          pointHistories: asList(s.point_histories).map((ph) => ({
            date: String(ph.date || ''),
            description: String(ph.description || ''),
            points: Number(ph.points || 0),
          })),
          attendances: asList(s.attendances || (progress?.attendances as JsonMap)?.items).map((att) => ({
            event: String(att.event || ''),
            status: String(att.status || '') as AttendanceStatus,
          })),
          imageUrl: String((profile?.photo_url as string) || s.imageUrl || ''),
          profile: profile
          ? {
              university: String(profile.university || ''),
              major: String(profile.major || ''),
              photoUrl: String(profile.photo_url || ''),
              profileLink: String(profile.profile_link || ''),
            }
          : undefined,
        };
      });

      const rawMentor = data.metadata?.mentor || data.mentor;
      const mentorInfo = rawMentor
        ? {
            group: rawMentor.group || '',
            mentorCode: rawMentor.mentor_code || '',
            name: rawMentor.name || '',
          }
        : undefined;

      setStudentData(parsedStudents, mentorInfo);

      toast({
        title: 'Scraping complete!',
        description: `Successfully scraped ${studentCount} students. Redirecting to dashboard...`,
      });

      onScrapeSuccess?.();

      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (error) {
      setIsLoading(false);
      setProgress(0);
      setStatusMessage('');

      toast({
        title: 'Error loading data',
        description: error instanceof Error ? error.message : 'Failed to load scraped data',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Dicoding Credentials
        </CardTitle>
        <CardDescription>
          Enter your Dicoding account credentials to automatically scrape student data.
          Your credentials are not stored anywhere.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your-email@student.devacademy.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your Dicoding password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          {isLoading && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  {progress === 100 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-green-700">{statusMessage}</span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{statusMessage}</span>
                    </>
                  )}
                </span>
                <span className="text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Usually around 1 minute. Please don&apos;t close this page.
              </p>
            </div>
          )}

          <div className="bg-muted/50 p-3 rounded-md text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Your credentials are sent securely and not stored anywhere
            </p>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scraping in progress...
              </>
            ) : (
              'Start Scraping'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
