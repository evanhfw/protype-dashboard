import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useStudentData } from '@/contexts/StudentDataContext';
import { parseStudentHTML, readFileAsText, validateFileSize } from '@/lib/htmlParser';
import { ParsedStudent, MentorInfo, mapStatus } from '@/data/parsedData';
import { CredentialsForm } from '@/components/dashboard/CredentialsForm';
import { ThemeToggle } from '@/components/theme-toggle';

const UploadPage = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedHtml, setPastedHtml] = useState('');
  const [activeTab, setActiveTab] = useState('credentials');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setStudentData } = useStudentData();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.name.endsWith('.html') && !file.name.endsWith('.json')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an HTML (.html) or JSON (.json) file',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size
    if (!validateFileSize(file)) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleParse = async () => {
    setIsLoading(true);

    try {
      let content = '';

      // Get content from file or textarea
      if (selectedFile) {
        content = await readFileAsText(selectedFile);
      } else if (pastedHtml) {
        content = pastedHtml;
      } else {
        toast({
          title: 'No input',
          description: 'Please upload a file or paste content',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Detect JSON vs HTML
      const isJsonFile = selectedFile?.name.endsWith('.json');
      const isJsonContent = !selectedFile && content.trim().startsWith('{');

      if (isJsonFile || isJsonContent) {
        // Parse as JSON
        const data = JSON.parse(content);
        const students: ParsedStudent[] = (data.students || []).map((s: any) => {
          const profile = s.profile || {};
          const progress = s.progress || {};
          const courseItems = progress.course_progress?.items || [];
          const assignmentItems = progress.assignments?.items || [];

          return {
            name: profile.name || s.name || '',
            status: mapStatus(profile.status_badge || s.status || null),
            courses: courseItems.map((c: any) => ({
              name: c.course || '',
              progress: c.progress_percent || '0%',
              status: c.status === 'Completed' ? 'Completed' as const
                : c.status === 'In Progress' ? 'In Progress' as const
                : 'Not Started' as const,
            })),
            assignments: assignmentItems.map((a: any) => ({
              name: a.assignment || a.name || '',
              status: a.status === 'Completed' ? 'Completed' as const
                : a.status === 'Late' ? 'Late' as const
                : a.status === 'Resubmit' ? 'Resubmit' as const
                : 'Uncompleted' as const,
            })),
            dailyCheckins: (progress.daily_checkins?.items || []).map((ci: any) => ({
              date: ci.date || '',
              mood: ci.mood || 'neutral',
              goals: (ci.goals || []).map((g: any) => ({
                title: g.title || '',
                items: g.items || [],
              })),
              reflection: ci.reflection || '',
            })),
            pointHistories: (progress.point_histories?.items || []).map((ph: any) => ({
              date: ph.date || '',
              description: ph.description || '',
              points: ph.points || 0,
            })),
            imageUrl: profile.photo_url || '',
            profile: {
              university: profile.university || '',
              major: profile.major || '',
              photoUrl: profile.photo_url || '',
              profileLink: profile.profile_link || '',
            },
            lastUpdatedDicoding: progress.course_progress?.last_updated || '',
          };
        });

        if (students.length === 0) {
          toast({
            title: 'No students found',
            description: 'The JSON file does not contain valid student data',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }

        // Extract mentor info
        const rawMentor = data.mentor;
        const mentorInfo: MentorInfo | undefined = rawMentor ? {
          group: rawMentor.group || '',
          mentorCode: rawMentor.mentor_code || '',
          name: rawMentor.name || '',
        } : undefined;

        setStudentData(students, mentorInfo);

        toast({
          title: 'Success!',
          description: `Parsed ${students.length} students from JSON`,
        });

        setTimeout(() => {
          navigate('/dashboard');
        }, 500);
      } else {
        // Parse as HTML (legacy flow)
        const result = parseStudentHTML(content);

        if (result.success && result.students) {
          setStudentData(result.students);
          toast({
            title: 'Success!',
            description: `Successfully parsed data for ${result.students.length} students`,
          });
          setTimeout(() => {
            navigate('/dashboard');
          }, 500);
        } else {
          toast({
            title: 'Parsing failed',
            description: result.error || 'Failed to parse HTML',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error parsing:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canParse = (selectedFile !== null || pastedHtml.trim().length > 0) && !isLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/30 transition-colors duration-500">
      <header className="border-b bg-background/60 backdrop-blur-xl px-6 py-4 flex justify-between items-center sticky top-0 z-50 border-border/50 shadow-sm">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
          diCodex <span className="text-card-foreground text-lg ml-1 font-semibold">— Upload Student Data</span>
        </h1>
        <ThemeToggle />
      </header>

      <main className="mx-auto max-w-4xl p-6">
        <Card className="shadow-lg border-primary/10 hover:border-primary/20 transition-all duration-300">
          <CardHeader>
            <CardTitle>Get Student Data</CardTitle>
            <CardDescription>
              Auto-scrape from Dicoding, upload an HTML file, or paste HTML content
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="credentials">Auto Scrape</TabsTrigger>
                <TabsTrigger value="upload">Upload File</TabsTrigger>
                <TabsTrigger value="paste">Paste HTML</TabsTrigger>
              </TabsList>

              {/* Tab 1: Auto Scrape with Credentials */}
              <TabsContent value="credentials" className="space-y-4">
                <CredentialsForm 
                  onScrapeSuccess={() => {
                    // Redirect to dashboard after scraping starts
                    toast({
                      title: 'Redirecting...',
                      description: 'You will be redirected to the dashboard',
                    });
                    setTimeout(() => navigate('/dashboard'), 1000);
                  }}
                />
              </TabsContent>

              {/* Tab 3: Upload File */}
              <TabsContent value="upload" className="space-y-4">
                <div
                  className={`relative rounded-xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
                    isDragging
                      ? 'border-primary bg-primary/10 scale-[1.02] shadow-md'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.01]'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.json"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        Drag and drop your HTML or JSON file here, or{' '}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-primary hover:underline"
                        >
                          browse
                        </button>
                      </p>
                      <p className="text-xs text-muted-foreground">Supports .html and .json files (max 10MB)</p>
                    </div>
                  </div>

                  {selectedFile && (
                    <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-muted p-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFile(null)}
                        className="ml-2 h-6 px-2"
                      >
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Tab 4: Paste HTML */}
              <TabsContent value="paste" className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Paste your HTML content here..."
                    value={pastedHtml}
                    onChange={(e) => setPastedHtml(e.target.value)}
                    className="min-h-[300px] font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    {pastedHtml.length.toLocaleString()} characters
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Parse Button */}
            {activeTab !== 'credentials' && (
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleParse}
                  disabled={!canParse}
                  className="min-w-[200px] shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Parse & View Dashboard
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-foreground mb-2">Option 1: Auto Scrape (Recommended)</h4>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Enter your Dicoding email and password</li>
                  <li>Click "Start Scraping" to automatically fetch the latest data</li>
                  <li>Wait ~30 second for the scraping to complete</li>
                  <li>You will be automatically redirected to the dashboard</li>
                </ol>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Option 2: Manual Upload</h4>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Upload an HTML file or paste HTML content from the diCodex page</li>
                  <li>Click "Parse & View Dashboard" to process the data</li>
                  <li>You will be automatically redirected to the dashboard</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default UploadPage;
