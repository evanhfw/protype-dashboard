import { useState, useMemo } from "react";
import { ParsedStudent, getCheckinStats, getCheckinHeatmapData, parseCheckinDate, CheckinMood, getCheckinDateKey, getLocalDateKey } from "@/data/parsedData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarCheck, Flame, SmilePlus, UserX, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DailyCheckinOverviewProps {
  students: ParsedStudent[];
}

const moodEmoji: Record<CheckinMood, string> = {
  good: "😊",
  neutral: "😐",
  bad: "😟",
};

const moodLabel: Record<CheckinMood, string> = {
  good: "Good",
  neutral: "Neutral",
  bad: "Bad",
};

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const formatDateShort = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const DailyCheckinOverview = ({ students }: DailyCheckinOverviewProps) => {
  const [expandedFeedIndex, setExpandedFeedIndex] = useState<number | null>(null);

  const stats = useMemo(() => getCheckinStats(students), [students]);
  const heatmap = useMemo(() => getCheckinHeatmapData(students), [students]);

  // Build a flat feed of all recent check-ins, sorted by date desc
  const recentFeed = useMemo(() => {
    const feed: {
      studentName: string;
      photoUrl?: string;
      mood: CheckinMood;
      date: string;
      parsedDate: Date;
      goals: { title: string; items: string[] }[];
      reflection: string;
    }[] = [];

    students.forEach(student => {
      (student.dailyCheckins || []).forEach(ci => {
        feed.push({
          studentName: student.name,
          photoUrl: student.profile?.photoUrl || student.imageUrl,
          mood: ci.mood,
          date: ci.date,
          parsedDate: parseCheckinDate(ci.date),
          goals: ci.goals,
          reflection: ci.reflection,
        });
      });
    });

    feed.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());
    return feed;
  }, [students]);

  // Calculate Today's Stats
  const todayStats = useMemo(() => {
    const todayKey = getLocalDateKey(new Date());

    let checkedInCount = 0;
    let moodGoodCount = 0;
    let moodNeutralCount = 0;
    let moodBadCount = 0;

    students.forEach(s => {
      const todayCheckin = (s.dailyCheckins || []).find(ci => {
        return getCheckinDateKey(ci.date) === todayKey;
      });

      if (todayCheckin) {
        checkedInCount++;
        if (todayCheckin.mood === 'good') moodGoodCount++;
        else if (todayCheckin.mood === 'neutral') moodNeutralCount++;
        else moodBadCount++;
      }
    });

    return {
      checkedInCount,
      moodGoodCount,
      moodNeutralCount,
      moodBadCount,
      missingCount: students.length - checkedInCount,
    };
  }, [students]);

  if (stats.totalCheckins === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Daily Check-ins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-sm text-muted-foreground">
            No daily check-in data available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const topStreak = stats.streaks[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Daily Check-ins
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPI Mini Cards - Focused on TODAY */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Checked In Today */}
          <div className="rounded-lg border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5" />
              Checked In Today
            </div>
            <div className="text-2xl font-bold text-card-foreground">
              {todayStats.checkedInCount}
              <span className="text-muted-foreground text-sm font-normal ml-1">/ {students.length}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {todayStats.checkedInCount === students.length 
                ? "All students checked in! 🎉"
                : `${Math.round((todayStats.checkedInCount / students.length) * 100)}% attendance`}
            </div>
          </div>

           {/* Mood Distribution Today */}
           <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <SmilePlus className="h-3.5 w-3.5" />
              Mood Distribution
            </div>
            
            {/* Stacked bar */}
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-secondary">
              {todayStats.moodGoodCount > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${(todayStats.moodGoodCount / todayStats.checkedInCount) * 100}%` }}
                />
              )}
              {todayStats.moodNeutralCount > 0 && (
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${(todayStats.moodNeutralCount / todayStats.checkedInCount) * 100}%` }}
                />
              )}
               {todayStats.moodBadCount > 0 && (
                <div
                  className="h-full bg-red-400 transition-all"
                  style={{ width: `${(todayStats.moodBadCount / todayStats.checkedInCount) * 100}%` }}
                />
              )}
            </div>

            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                {todayStats.moodGoodCount}
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-amber-400" />
                {todayStats.moodNeutralCount}
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                {todayStats.moodBadCount}
              </span>
            </div>
          </div>

          {/* Top Streak (Kept for motivation) */}
          <div className="rounded-lg border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              Top Streak
            </div>
            <div className="text-2xl font-bold text-card-foreground">
              {topStreak?.streak || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {topStreak?.name || "—"}
            </div>
          </div>

          {/* Missing Today */}
          <div className="rounded-lg border bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <UserX className="h-3.5 w-3.5 text-red-400" />
              Missing Today
            </div>
            <div className={cn(
              "text-2xl font-bold",
              todayStats.missingCount > 0 ? "text-status-red" : "text-status-green"
            )}>
              {todayStats.missingCount}
            </div>
            <div className="text-[11px] text-muted-foreground">
              students haven't checked in
            </div>
          </div>
        </div>

        {/* Heatmap Calendar */}
        {heatmap.dates.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-card-foreground">Check-in Heatmap</h3>
            <TooltipProvider>
              <div className="overflow-x-auto pb-2">
                <div className="min-w-fit">
                  {/* Date headers */}
                  <div className="flex items-center gap-0.5 mb-1">
                    <div className="w-[120px] shrink-0 sticky left-0 z-10 bg-card" />
                    {heatmap.dates.map(date => (
                      <div
                        key={date}
                        className="w-8 text-center text-[10px] text-muted-foreground"
                        title={date}
                      >
                        {formatDateShort(date)}
                      </div>
                    ))}
                  </div>
                  {/* Rows */}
                  {heatmap.rows.map((row) => (
                    <div key={row.name} className="flex items-center gap-0.5 mb-0.5">
                      <div className="w-[120px] text-xs text-muted-foreground truncate pr-2 text-right shrink-0 sticky left-0 z-10 bg-card">
                        {row.name.split(" ")[0]}
                      </div>
                      {row.cells.map((cell) => (
                        <Tooltip key={`${row.name}-${cell.date}`} delayDuration={0}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "h-7 w-8 rounded-sm border transition-all cursor-default",
                                cell.hasCheckin
                                  ? cell.mood === "good"
                                    ? "bg-emerald-500 hover:bg-emerald-600 border-emerald-600"
                                    : cell.mood === "neutral"
                                    ? "bg-amber-400 hover:bg-amber-500 border-amber-500"
                                    : "bg-red-400 hover:bg-red-500 border-red-500"
                                  : "bg-muted/30 border-transparent hover:border-border"
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent className="p-3 max-w-[280px]">
                            <div className="space-y-2">
                              {/* Header */}
                              <div className="flex items-center justify-between gap-4 border-b pb-2">
                                <div>
                                  <p className="font-semibold">{row.name}</p>
                                  <p className="text-xs text-muted-foreground">{cell.date}</p>
                                </div>
                                {cell.hasCheckin && (
                                  <span className="text-lg">{moodEmoji[cell.mood!]}</span>
                                )}
                              </div>
                              
                              {/* Content */}
                              {cell.hasCheckin ? (
                                <div className="space-y-2">
                                  {/* Goals */}
                                  {cell.goals && cell.goals.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Goals</p>
                                      {cell.goals.map((g, idx) => (
                                        <div key={idx} className="text-xs">
                                          <span className="font-medium text-foreground">{g.title}</span>
                                          <div className="flex flex-wrap gap-1 mt-0.5">
                                            {g.items.map((item, iIdx) => (
                                              <span key={iIdx} className="inline-flex items-center rounded-sm bg-muted px-1 py-0 text-[10px] text-muted-foreground">
                                                {item}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {/* Reflection */}
                                  {cell.reflection && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Reflection</p>
                                      <p className="text-xs italic text-muted-foreground leading-relaxed">
                                        "{cell.reflection}"
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">No check-in for this day.</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  ))}
                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                    <div className="w-[120px] shrink-0 sticky left-0 z-10 bg-card" />
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sm bg-emerald-500 border border-emerald-600" />
                      <span>Good</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sm bg-amber-400 border border-amber-500" />
                      <span>Neutral</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sm bg-red-400 border border-red-500" />
                      <span>Bad</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-sm bg-muted/30 border border-transparent" />
                      <span>No check-in</span>
                    </div>
                  </div>
                </div>
              </div>
            </TooltipProvider>
          </div>
        )}

        {/* Recent Check-ins Feed */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-card-foreground">
            Recent Check-ins
          </h3>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
            {recentFeed.slice(0, 20).map((entry, idx) => {
              const isExpanded = expandedFeedIndex === idx;
              return (
                <div key={`${entry.studentName}-${entry.date}-${idx}`}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors",
                      isExpanded ? "bg-muted/30 border-primary/20" : "hover:bg-muted/50"
                    )}
                    onClick={() => setExpandedFeedIndex(isExpanded ? null : idx)}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={entry.photoUrl} alt={entry.studentName} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(entry.studentName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-card-foreground truncate block">
                        {entry.studentName}
                      </span>
                    </div>
                    <span className="text-lg" title={moodLabel[entry.mood]}>
                      {moodEmoji[entry.mood]}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {entry.date.replace(/^\w+,\s*/, "")}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                  {/* Expanded content */}
                  <div
                    className={cn(
                      "grid transition-all duration-300 ease-in-out",
                      isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    )}
                  >
                    <div className="overflow-hidden">
                      {isExpanded && (
                        <div className="ml-4 border-l-2 border-primary/10 pl-3 py-2 space-y-2">
                          {/* Goals */}
                          {entry.goals.map((goal, gIdx) => (
                            <div key={gIdx}>
                              <p className="text-xs font-medium text-card-foreground mb-1">
                                📚 {goal.title}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {goal.items.map((item, iIdx) => (
                                  <span
                                    key={iIdx}
                                    className="inline-flex items-center rounded-md bg-primary/5 border border-primary/10 px-2 py-0.5 text-[11px] text-muted-foreground"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                          {/* Reflection */}
                          {entry.reflection && (
                            <div className="rounded-md bg-muted/30 px-3 py-2 mt-1">
                              <p className="text-xs text-muted-foreground italic leading-relaxed">
                                "{entry.reflection}"
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyCheckinOverview;
