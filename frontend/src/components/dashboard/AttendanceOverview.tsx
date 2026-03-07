import { useState, useMemo } from "react";
import { ParsedStudent, AttendanceStatus, AttendanceEventStats, getAttendanceStats } from "@/data/parsedData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  VideoOff,
  ArrowLeftRight,
  ChevronDown,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceOverviewProps {
  students: ParsedStudent[];
}

type SortField = "event" | "attendanceRate" | "attending" | "absent";
type SortDirection = "asc" | "desc";

const ATTENDANCE_STATUS_CONFIG: Record<AttendanceStatus, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  barClass: string;
  statKey: keyof Pick<AttendanceEventStats, "attending" | "late" | "absent" | "replaced" | "offCam" | "abstract">;
}> = {
  Attending: {
    label: "Attending",
    icon: CheckCircle2,
    colorClass: "text-status-green",
    bgClass: "bg-status-green/15 text-status-green border-status-green/30",
    barClass: "bg-status-green",
    statKey: "attending",
  },
  Late: {
    label: "Late",
    icon: Clock,
    colorClass: "text-status-yellow",
    bgClass: "bg-status-yellow/15 text-status-yellow border-status-yellow/30",
    barClass: "bg-status-yellow",
    statKey: "late",
  },
  "Off Cam": {
    label: "Off Cam",
    icon: VideoOff,
    colorClass: "text-status-orange",
    bgClass: "bg-status-orange/15 text-status-orange border-status-orange/30",
    barClass: "bg-status-orange",
    statKey: "offCam",
  },
  Replaced: {
    label: "Replaced",
    icon: ArrowLeftRight,
    colorClass: "text-status-blue",
    bgClass: "bg-status-blue/15 text-status-blue border-status-blue/30",
    barClass: "bg-status-blue",
    statKey: "replaced",
  },
  Absent: {
    label: "Absent",
    icon: XCircle,
    colorClass: "text-status-red",
    bgClass: "bg-status-red/15 text-status-red border-status-red/30",
    barClass: "bg-status-red",
    statKey: "absent",
  },
  Abstract: {
    label: "Abstract",
    icon: UserX,
    colorClass: "text-purple-500",
    bgClass: "bg-purple-500/15 text-purple-500 border-purple-500/30",
    barClass: "bg-purple-500",
    statKey: "abstract",
  },
};

const STATUS_ORDER: AttendanceStatus[] = ["Attending", "Late", "Off Cam", "Replaced", "Abstract", "Absent"];

const AttendanceOverview = ({ students }: AttendanceOverviewProps) => {
  const [sortField, setSortField] = useState<SortField>("event");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const stats = useMemo(() => getAttendanceStats(students), [students]);

  const sortedEvents = useMemo(() => {
    const sorted = [...stats];
    sorted.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "event": aVal = a.event; bVal = b.event; break;
        case "attendanceRate": aVal = a.attendanceRate; bVal = b.attendanceRate; break;
        case "attending": aVal = a.attending; bVal = b.attending; break;
        case "absent": aVal = a.absent; bVal = b.absent; break;
        default: aVal = a.event; bVal = b.event;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [stats, sortField, sortDirection]);

  const studentsByStatus = useMemo(() => {
    if (!expandedEvent) return new Map<AttendanceStatus, { name: string }[]>();
    const map = new Map<AttendanceStatus, { name: string }[]>();
    for (const s of STATUS_ORDER) map.set(s, []);

    students.forEach(student => {
      const att = (student.attendances || []).find(a => a.event === expandedEvent);
      if (att) {
        const list = map.get(att.status) || [];
        list.push({ name: student.name });
        map.set(att.status, list);
      }
    });
    return map;
  }, [expandedEvent, students]);

  if (stats.length === 0) return null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        "flex items-center gap-1 hover:text-foreground transition-colors",
        sortField === field ? "text-foreground font-semibold" : "text-muted-foreground"
      )}
    >
      {children}
      {sortField === field && (
        <span className="text-xs">{sortDirection === "asc" ? "↑" : "↓"}</span>
      )}
    </button>
  );

  const totalEvents = stats.length;
  const avgAttendanceRate = totalEvents > 0
    ? Math.round(stats.reduce((sum, s) => sum + s.attendanceRate, 0) / totalEvents)
    : 0;
  const fullAttendance = stats.filter(s => s.attendanceRate === 100).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Attendance Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-card-foreground">{totalEvents}</div>
            <div className="text-xs text-muted-foreground">Total Events</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className={cn(
              "text-2xl font-bold",
              avgAttendanceRate >= 80 ? "text-status-green" : avgAttendanceRate >= 60 ? "text-status-yellow" : "text-status-red"
            )}>
              {avgAttendanceRate}%
            </div>
            <div className="text-xs text-muted-foreground">Avg Attendance</div>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-status-green">{fullAttendance}</div>
            <div className="text-xs text-muted-foreground">Full Attendance</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-left text-xs font-medium whitespace-nowrap">
                  <SortButton field="event">Event</SortButton>
                </th>
                <th className="pb-3 text-center text-xs font-medium whitespace-nowrap">
                  <SortButton field="attendanceRate">Rate</SortButton>
                </th>
                <th className="pb-3 text-center text-xs font-medium whitespace-nowrap">
                  <SortButton field="attending">Breakdown</SortButton>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map((event, index) => {
                const isExpanded = expandedEvent === event.event;

                return (
                  <>
                    <tr
                      key={index}
                      className={cn(
                        "border-b last:border-b-0 transition-colors cursor-pointer",
                        isExpanded ? "bg-muted/30" : "hover:bg-muted/50"
                      )}
                      onClick={() => setExpandedEvent(isExpanded ? null : event.event)}
                    >
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                              isExpanded && "rotate-180"
                            )}
                          />
                          <p className="text-sm font-medium text-card-foreground truncate max-w-[200px] sm:max-w-none">
                            {event.event}
                          </p>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-center gap-2">
                          <SegmentedBar event={event} />
                          <span className="w-10 text-right text-xs font-medium text-muted-foreground">
                            {event.attendanceRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {STATUS_ORDER.map(statusKey => {
                            const config = ATTENDANCE_STATUS_CONFIG[statusKey];
                            const count = event[config.statKey];
                            if (count === 0) return null;
                            const Icon = config.icon;
                            return (
                              <div key={statusKey} className={cn("flex items-center gap-0.5 text-xs", config.colorClass)} title={config.label}>
                                <Icon className="h-3 w-3" />
                                <span>{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>

                    <tr key={`${index}-expanded`}>
                      <td colSpan={3} className="p-0">
                        <div
                          className={cn(
                            "grid transition-all duration-300 ease-in-out",
                            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                          )}
                        >
                          <div className="overflow-hidden">
                            {isExpanded && (
                              <ExpandedEventDetail
                                studentsByStatus={studentsByStatus}
                              />
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 flex-wrap text-xs text-muted-foreground">
          {STATUS_ORDER.map(statusKey => {
            const config = ATTENDANCE_STATUS_CONFIG[statusKey];
            const Icon = config.icon;
            return (
              <div key={statusKey} className="flex items-center gap-1.5">
                <Icon className={cn("h-3 w-3", config.colorClass)} />
                <span>{config.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

function SegmentedBar({ event }: { event: AttendanceEventStats }) {
  if (event.totalStudents === 0) return null;

  const segments = STATUS_ORDER
    .map(statusKey => {
      const config = ATTENDANCE_STATUS_CONFIG[statusKey];
      const count = event[config.statKey];
      const pct = (count / event.totalStudents) * 100;
      return { statusKey, pct, barClass: config.barClass };
    })
    .filter(s => s.pct > 0);

  return (
    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary flex">
      {segments.map(({ statusKey, pct, barClass }) => (
        <div
          key={statusKey}
          className={cn("h-full transition-all first:rounded-l-full last:rounded-r-full", barClass)}
          style={{ width: `${pct}%` }}
        />
      ))}
    </div>
  );
}

function ExpandedEventDetail({
  studentsByStatus,
}: {
  studentsByStatus: Map<AttendanceStatus, { name: string }[]>;
}) {
  const nonEmptyStatuses = STATUS_ORDER.filter(s => (studentsByStatus.get(s)?.length ?? 0) > 0);
  const allPresent = nonEmptyStatuses.length === 1 && nonEmptyStatuses[0] === "Attending";
  const [activeTab, setActiveTab] = useState<AttendanceStatus>(nonEmptyStatuses[0] ?? "Attending");

  const activeConfig = ATTENDANCE_STATUS_CONFIG[activeTab];
  const ActiveIcon = activeConfig.icon;
  const activeList = studentsByStatus.get(activeTab) || [];

  return (
    <div className="border-t-2 border-muted bg-muted/20 p-4">
      {allPresent ? (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-status-green border rounded-md bg-card/50">
          <CheckCircle2 className="h-4 w-4" />
          All students attending!
        </div>
      ) : (
        <div>
          {/* Status tabs */}
          <div className="flex gap-1 mb-3 border-b border-border pb-2 overflow-x-auto">
            {nonEmptyStatuses.map(statusKey => {
              const config = ATTENDANCE_STATUS_CONFIG[statusKey];
              const count = studentsByStatus.get(statusKey)?.length ?? 0;
              const Icon = config.icon;
              const isActive = activeTab === statusKey;

              return (
                <button
                  key={statusKey}
                  onClick={(e) => { e.stopPropagation(); setActiveTab(statusKey); }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                    isActive
                      ? cn("bg-card border shadow-sm", config.colorClass)
                      : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {config.label}
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold",
                    isActive ? cn(config.bgClass) : "bg-muted"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Student list for active tab */}
          <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1">
            {activeList.map((student, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-sm"
              >
                <ActiveIcon className={cn("h-3.5 w-3.5 shrink-0", activeConfig.colorClass)} />
                <span className="text-sm font-medium text-card-foreground truncate">
                  {student.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AttendanceOverview;
