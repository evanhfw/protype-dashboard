import { useState, useMemo } from "react";
import { ParsedStudent, ParsedStudentStatus, calculateAverageProgress, getStatusColor } from "@/data/parsedData";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, Search, ChevronDown, GraduationCap, BookOpen, ExternalLink, CalendarCheck, CheckCircle2, XCircle, Clock, VideoOff, ArrowLeftRight, UserX } from "lucide-react";
import type { AttendanceStatus } from "@/data/parsedData";
import { cn } from "@/lib/utils";

interface AllStudentsViewProps {
  students: ParsedStudent[];
}

type SortOption = "name-asc" | "name-desc" | "status" | "progress-asc" | "progress-desc";

const statusDotMap: Record<string, string> = {
  "status-red": "bg-status-red",
  "status-yellow": "bg-status-yellow",
  "status-green": "bg-status-green",
  "status-blue": "bg-status-blue",
};

const statusPriority: Record<ParsedStudentStatus, number> = {
  "Special Attention": 1,
  "Lagging": 2,
  "Ideal": 3,
  "Ahead": 4,
};

const attendanceIconMap: Record<AttendanceStatus, { icon: React.ComponentType<{ className?: string }>; colorClass: string; bgClass: string }> = {
  Attending: { icon: CheckCircle2, colorClass: "text-status-green", bgClass: "bg-status-green/15" },
  Late: { icon: Clock, colorClass: "text-status-yellow", bgClass: "bg-status-yellow/15" },
  Absent: { icon: XCircle, colorClass: "text-status-red", bgClass: "bg-status-red/15" },
  Replaced: { icon: ArrowLeftRight, colorClass: "text-status-blue", bgClass: "bg-status-blue/15" },
  "Off Cam": { icon: VideoOff, colorClass: "text-status-orange", bgClass: "bg-status-orange/15" },
  Abstract: { icon: UserX, colorClass: "text-purple-500", bgClass: "bg-purple-500/15" },
};

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const getStatusLabel = (status: ParsedStudentStatus | null): string => {
  switch (status) {
    case "Special Attention": return "Need Special Attention";
    case "Lagging": return "Lagging Behind";
    case "Ideal": return "On Ideal Schedule";
    case "Ahead": return "Ahead of Schedule";
    default: return "Unknown";
  }
};

const getStatusBadgeStyles = (status: ParsedStudentStatus | null) => {
  switch (status) {
    case "Special Attention":
      return "bg-status-red/15 text-status-red border-status-red/30";
    case "Lagging":
      return "bg-status-yellow/15 text-status-yellow border-status-yellow/30";
    case "Ideal":
      return "bg-status-green/15 text-status-green border-status-green/30";
    case "Ahead":
      return "bg-status-blue/15 text-status-blue border-status-blue/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const AllStudentsView = ({ students }: AllStudentsViewProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ParsedStudentStatus>("All");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  // Filter and sort students
  const filteredAndSortedStudents = useMemo(() => {
    let result = [...students];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((student) =>
        student.name.toLowerCase().includes(query) ||
        student.profile?.university?.toLowerCase().includes(query) ||
        student.profile?.major?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "All") {
      result = result.filter((student) => student.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "status": {
          const aPriority = a.status ? statusPriority[a.status] : 999;
          const bPriority = b.status ? statusPriority[b.status] : 999;
          return aPriority - bPriority;
        }
        case "progress-asc": {
          const aProgress = calculateAverageProgress(a.courses);
          const bProgress = calculateAverageProgress(b.courses);
          return aProgress - bProgress;
        }
        case "progress-desc": {
          const aProgress = calculateAverageProgress(a.courses);
          const bProgress = calculateAverageProgress(b.courses);
          return bProgress - aProgress;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [students, searchQuery, statusFilter, sortBy]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-primary" />
          All Students View
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, university, or major..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "All" | ParsedStudentStatus)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              <SelectItem value="Special Attention">Special Attention</SelectItem>
              <SelectItem value="Lagging">Lagging</SelectItem>
              <SelectItem value="Ideal">Ideal</SelectItem>
              <SelectItem value="Ahead">Ahead</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as SortOption)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="progress-asc">Progress (Low-High)</SelectItem>
              <SelectItem value="progress-desc">Progress (High-Low)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Student List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredAndSortedStudents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {searchQuery || statusFilter !== "All"
                ? "No students found matching your filters"
                : "No students available"}
            </p>
          ) : (
            filteredAndSortedStudents.map((student, index) => {
              const isExpanded = expandedIndex === index;
              const avgProgress = calculateAverageProgress(student.courses);
              const completedCourses = student.courses.filter((c) => c.status === "Completed").length;
              const statusColor = getStatusColor(student.status);
              const statusBgColor = statusDotMap[statusColor] || "bg-muted";
              const photoUrl = student.profile?.photoUrl || student.imageUrl;

              return (
                <div key={`${student.name}-${index}`}>
                  <div
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-md border px-4 py-3 transition-colors",
                      student.status === "Special Attention" && "bg-status-red/5 border-status-red/20 hover:bg-status-red/10",
                      student.status === "Lagging" && "bg-status-yellow/5 border-status-yellow/20 hover:bg-status-yellow/10",
                      student.status === "Ideal" && "bg-status-green/5 border-status-green/20 hover:bg-status-green/10",
                      student.status === "Ahead" && "bg-status-blue/5 border-status-blue/20 hover:bg-status-blue/10",
                      !student.status && "bg-muted/5 border-border hover:bg-muted/10"
                    )}
                    onClick={() => toggleExpand(index)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={photoUrl} alt={student.name} />
                        <AvatarFallback className="text-xs">
                          {getInitials(student.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-card-foreground truncate block">
                          {student.name}
                        </span>
                        {student.profile?.university && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {student.profile.university}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Status badge */}
                      {student.status && (
                        <span
                          className={cn(
                            "hidden sm:inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                            student.status === "Special Attention" && "bg-status-red/15 text-status-red",
                            student.status === "Lagging" && "bg-status-yellow/15 text-status-yellow",
                            student.status === "Ideal" && "bg-status-green/15 text-status-green",
                            student.status === "Ahead" && "bg-status-blue/15 text-status-blue"
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusBgColor)} />
                          {getStatusLabel(student.status)}
                        </span>
                      )}
                      {/* Compact progress indicator */}
                      <div className="hidden md:flex items-center gap-2">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-secondary">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  avgProgress >= 70 ? "bg-status-green"
                                    : avgProgress >= 40 ? "bg-status-yellow"
                                    : "bg-status-red"
                                )}
                                style={{ width: `${avgProgress}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-medium text-muted-foreground w-8 text-right">
                              {avgProgress}%
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {completedCourses}/{student.courses.length} courses
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </div>
                  </div>

                  {/* Expanded detail section */}
                  <div
                    className={cn(
                      "grid transition-all duration-300 ease-in-out",
                      isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className={cn(
                        "ml-2 mt-1 space-y-3 border-l-2 pl-3",
                        student.status === "Special Attention" && "border-status-red/20",
                        student.status === "Lagging" && "border-status-yellow/20",
                        student.status === "Ideal" && "border-status-green/20",
                        student.status === "Ahead" && "border-status-blue/20",
                        !student.status && "border-border"
                      )}>
                        {/* Profile Card */}
                        <div className="rounded-lg border bg-card p-5 mt-2">
                          <div className="flex flex-col items-center text-center gap-3">
                            <Avatar className="h-24 w-24 ring-2 ring-offset-2 ring-offset-background ring-primary/20">
                              <AvatarImage src={photoUrl} alt={student.name} className="object-cover" />
                              <AvatarFallback className="text-2xl font-semibold">
                                {getInitials(student.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                              <h3 className="text-lg font-semibold text-card-foreground">
                                {student.name}
                              </h3>
                              {student.status && (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                    getStatusBadgeStyles(student.status)
                                  )}
                                >
                                  <span className={cn("h-2 w-2 rounded-full", statusBgColor)} />
                                  {getStatusLabel(student.status)}
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 w-full">
                              {student.profile?.university && (
                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                  <GraduationCap className="h-4 w-4 shrink-0" />
                                  <span>{student.profile.university}</span>
                                </div>
                              )}
                              {student.profile?.major && (
                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                  <BookOpen className="h-4 w-4 shrink-0" />
                                  <span>{student.profile.major}</span>
                                </div>
                              )}
                              {student.profile?.profileLink && (
                                <div className="flex items-center justify-center gap-2 text-sm mt-1">
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <a
                                    href={`https://codingcamp.dicoding.com${student.profile.profileLink}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    CodingCamp Profile
                                  </a>
                                </div>
                              )}
                            </div>
                            {/* Progress summary bar */}
                            <div className="flex items-center gap-4 pt-2 border-t w-full justify-center">
                              <div className="text-center">
                                <div className="text-xl font-bold text-card-foreground">{avgProgress}%</div>
                                <div className="text-[11px] text-muted-foreground">Avg Progress</div>
                              </div>
                              <div className="h-8 w-px bg-border" />
                              <div className="text-center">
                                <div className="text-xl font-bold text-card-foreground">{completedCourses}/{student.courses.length}</div>
                                <div className="text-[11px] text-muted-foreground">Completed</div>
                              </div>
                              <div className="h-8 w-px bg-border" />
                              <div className="text-center">
                                <div className="text-xl font-bold text-card-foreground">{student.dailyCheckins?.length || 0}</div>
                                <div className="text-[11px] text-muted-foreground">Check-ins</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Course Progress List */}
                        <div className="pb-2">
                          <div className="mb-2 px-3 py-1 text-xs font-medium text-muted-foreground">
                            Course Progress
                          </div>
                          {student.courses.map((course, courseIndex) => (
                            <div key={courseIndex} className="rounded-md px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-card-foreground truncate">
                                    {course.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {course.status}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                                    <div
                                      className={cn(
                                        "h-full rounded-full transition-all",
                                        course.status === "Completed"
                                          ? "bg-status-green"
                                          : course.status === "In Progress"
                                          ? "bg-status-yellow"
                                          : "bg-status-red"
                                      )}
                                      style={{ width: course.progress }}
                                    />
                                  </div>
                                  <span className="w-10 text-right text-xs font-medium text-muted-foreground">
                                    {course.progress}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Assignments Checklist */}
                        {student.assignments && student.assignments.length > 0 && (
                          <div className="pb-2">
                            <div className="mb-2 px-3 py-1 text-xs font-medium text-muted-foreground">
                              Assignments ({student.assignments.filter(a => a.status === "Completed").length}/{student.assignments.length} completed)
                            </div>
                            {student.assignments.map((assignment, aIdx) => {
                              const isCompleted = assignment.status === "Completed";
                              const isLate = assignment.status === "Late";
                              return (
                                <div key={aIdx} className="flex items-center gap-2 rounded-md px-3 py-1.5">
                                  <span className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                                    isCompleted
                                      ? "bg-status-green/15 text-status-green"
                                      : isLate
                                      ? "bg-status-yellow/15 text-status-yellow"
                                      : "bg-status-red/15 text-status-red"
                                  )}>
                                    {isCompleted ? "✓" : isLate ? "!" : "✗"}
                                  </span>
                                  <p className={cn(
                                    "text-xs truncate flex-1",
                                    isCompleted
                                      ? "text-muted-foreground"
                                      : "text-card-foreground font-medium"
                                  )}>
                                    {assignment.name}
                                  </p>
                                  {isLate && (
                                    <span className="text-[10px] font-medium text-status-yellow shrink-0">Late</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Attendances Checklist */}
                        {student.attendances && student.attendances.length > 0 && (
                          <div className="pb-2">
                            <div className="mb-2 px-3 py-1 text-xs font-medium text-muted-foreground">
                              Attendances ({student.attendances.filter(a => a.status !== "Absent").length}/{student.attendances.length} present)
                            </div>
                            {student.attendances.map((att, attIdx) => {
                              const cfg = attendanceIconMap[att.status] || attendanceIconMap.Absent;
                              const Icon = cfg.icon;
                              return (
                                <div key={attIdx} className="flex items-center gap-2 rounded-md px-3 py-1.5">
                                  <span className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                                    cfg.bgClass, cfg.colorClass
                                  )}>
                                    <Icon className="h-2.5 w-2.5" />
                                  </span>
                                  <p className={cn(
                                    "text-xs truncate flex-1",
                                    att.status === "Attending"
                                      ? "text-muted-foreground"
                                      : "text-card-foreground font-medium"
                                  )}>
                                    {att.event}
                                  </p>
                                  {att.status !== "Attending" && (
                                    <span className={cn("text-[10px] font-medium shrink-0", cfg.colorClass)}>
                                      {att.status}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Daily Check-ins */}

                        {student.dailyCheckins && student.dailyCheckins.length > 0 ? (
                          <div className="pb-2">
                            <div className="mb-2 px-3 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                              <CalendarCheck className="h-3.5 w-3.5" />
                              Daily Check-ins ({student.dailyCheckins.length} entries)
                            </div>
                            <div className="h-[200px] w-full px-2">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                  data={[...student.dailyCheckins]
                                    .reverse()
                                    .map(ci => ({
                                      ...ci,
                                      parsedDate: new Date(ci.date.replace(/^\w+,\s*/, '')).getTime()
                                    }))
                                    .filter(ci => {
                                      const sevenDaysAgo = new Date();
                                      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
                                      sevenDaysAgo.setHours(0, 0, 0, 0);
                                      return ci.parsedDate >= sevenDaysAgo.getTime();
                                    })
                                    .map(ci => ({
                                      date: ci.date,
                                      parsedDate: ci.parsedDate,
                                      moodLevel: ci.mood === 'good' ? 3 : ci.mood === 'neutral' ? 2 : 1,
                                      mood: ci.mood,
                                      goals: ci.goals,
                                      reflection: ci.reflection
                                    }))
                                  }
                                  margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                  <XAxis 
                                    dataKey="parsedDate" 
                                    type="number"
                                    domain={[
                                      () => {
                                        const d = new Date();
                                        d.setDate(d.getDate() - 6);
                                        d.setHours(0,0,0,0);
                                        return d.getTime();
                                      },
                                      () => {
                                        const d = new Date();
                                        d.setHours(23,59,59,999);
                                        return d.getTime();
                                      }
                                    ]}
                                    ticks={[...Array(7)].map((_, i) => {
                                      const d = new Date();
                                      d.setDate(d.getDate() - (6 - i));
                                      d.setHours(0, 0, 0, 0);
                                      return d.getTime();
                                    })}
                                    tickFormatter={(time) => {
                                      const date = new Date(time);
                                      const today = new Date();
                                      today.setHours(0,0,0,0);
                                      
                                      const yesterday = new Date(today);
                                      yesterday.setDate(yesterday.getDate() - 1);

                                      // Compare timestamps
                                      if (time === today.getTime()) return "Today";
                                      if (time === yesterday.getTime()) return "Yesterday";
                                      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                    }}
                                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval={0}
                                    dy={10}
                                  />
                                  <YAxis 
                                    domain={[0, 4]} 
                                    ticks={[1, 2, 3]}
                                    tickFormatter={(val) => val === 3 ? "Good" : val === 2 ? "Neutral" : "Bad"}
                                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                    width={50}
                                    axisLine={false}
                                    tickLine={false}
                                  />
                                  <Tooltip
                                    cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                          <div className="rounded-md border bg-popover p-3 shadow-md max-w-[280px]">
                                            <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
                                              <span className="text-xs font-medium text-muted-foreground">
                                                {data.date}
                                              </span>
                                              <span className="text-lg">
                                                {data.mood === 'good' ? "😊" : data.mood === 'neutral' ? "😐" : "😟"}
                                              </span>
                                            </div>
                                            
                                            {/* Goals */}
                                            {data.goals && data.goals.length > 0 && (
                                              <div className="mb-2 space-y-1">
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Goals</p>
                                                {data.goals.map((g: any, i: number) => (
                                                  <div key={i} className="text-xs">
                                                    <span className="font-medium text-foreground">{g.title}</span>
                                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                                      {g.items.slice(0, 3).map((item: string, j: number) => (
                                                        <span key={j} className="inline-flex items-center rounded-sm bg-muted px-1 py-0 text-[10px] text-muted-foreground whitespace-nowrap">
                                                          {item}
                                                        </span>
                                                      ))}
                                                      {g.items.length > 3 && (
                                                        <span className="text-[10px] text-muted-foreground pl-0.5">+{g.items.length - 3}</span>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {/* Reflection */}
                                            {data.reflection && (
                                              <div className="space-y-1">
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Reflection</p>
                                                <p className="text-xs italic text-muted-foreground leading-relaxed line-clamp-4">
                                                  "{data.reflection}"
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Line
                                    type="linear"
                                    dataKey="moodLevel"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: "hsl(var(--foreground))" }}
                                    dot={(props: any) => {
                                      const { cx, cy, payload } = props;
                                      let fill = "hsl(var(--primary))";
                                      if (payload.mood === 'good') fill = "#10b981"; // emerald-500
                                      if (payload.mood === 'neutral') fill = "#fbbf24"; // amber-400
                                      if (payload.mood === 'bad') fill = "#f87171"; // red-400
                                      
                                      return (
                                        <circle 
                                          cx={cx} 
                                          cy={cy} 
                                          r={4} 
                                          fill={fill} 
                                          stroke="hsl(var(--background))" 
                                          strokeWidth={2}
                                          className="transition-all hover:r-6"
                                        />
                                      );
                                    }}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        ) : (
                          <div className="pb-2">
                            <div className="mb-2 px-3 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                              <CalendarCheck className="h-3.5 w-3.5" />
                              Daily Check-ins
                            </div>
                            <p className="px-3 text-xs text-muted-foreground italic">
                              No check-in data available
                            </p>
                          </div>
                        )}

                        {/* Point History */}
                        {student.pointHistories && (
                          <div className="pb-2">
                            <div className="mb-1 px-3 py-1 text-xs font-medium text-muted-foreground">
                              Point History — {student.pointHistories.reduce((sum, p) => sum + p.points, 0)} pts total
                            </div>
                            {student.pointHistories.length === 0 && (
                              <p className="px-3 text-xs text-muted-foreground italic">
                                No point history data yet
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AllStudentsView;
