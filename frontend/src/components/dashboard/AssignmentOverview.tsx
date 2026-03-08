import { useState, useMemo } from "react";
import { ParsedStudent, getAssignmentStats } from "@/data/parsedData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, CheckCircle2, XCircle, Clock, ChevronDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssignmentOverviewProps {
  students: ParsedStudent[];
}

type SortField = "name" | "completionRate" | "completed" | "uncompleted" | "late" | "resubmit";
type SortDirection = "asc" | "desc";

const AssignmentOverview = ({ students }: AssignmentOverviewProps) => {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [expandedAssignment, setExpandedAssignment] = useState<string | null>(null);

  const stats = useMemo(() => getAssignmentStats(students), [students]);

  const sortedAssignments = useMemo(() => {
    const sorted = [...stats];
    sorted.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "name": aVal = a.name; bVal = b.name; break;
        case "completionRate": aVal = a.completionRate; bVal = b.completionRate; break;
        case "completed": aVal = a.completed; bVal = b.completed; break;
        case "uncompleted": aVal = a.uncompleted; bVal = b.uncompleted; break;
        case "late": aVal = a.late; bVal = b.late; break;
        case "resubmit": aVal = a.resubmit; bVal = b.resubmit; break;
        default: aVal = a.name; bVal = b.name;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [stats, sortField, sortDirection]);

  const studentsByAssignmentStatus = useMemo(() => {
    if (!expandedAssignment) return { completed: [] as string[], uncompleted: [] as string[], late: [] as string[], resubmit: [] as string[] };
    const completed: string[] = [];
    const uncompleted: string[] = [];
    const late: string[] = [];
    const resubmit: string[] = [];
    students.forEach(s => {
      const a = (s.assignments || []).find(a => a.name === expandedAssignment);
      if (a) {
        if (a.status === "Completed") completed.push(s.name);
        else if (a.status === "Late") late.push(s.name);
        else if (a.status === "Resubmit") resubmit.push(s.name);
        else uncompleted.push(s.name);
      }
    });
    return { completed, uncompleted, late, resubmit };
  }, [expandedAssignment, students]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-5 w-5 text-primary" />
          Assignment Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-left text-xs font-medium whitespace-nowrap">
                  <SortButton field="name">Assignment</SortButton>
                </th>
                <th className="pb-3 text-center text-xs font-medium whitespace-nowrap">
                  <SortButton field="completionRate">Completion</SortButton>
                </th>
                <th className="pb-3 text-center text-xs font-medium whitespace-nowrap">
                  <SortButton field="completed">Status</SortButton>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAssignments.map((assignment, index) => {
                const isExpanded = expandedAssignment === assignment.name;

                return (
                  <>
                    <tr
                      key={index}
                      className={cn(
                        "border-b last:border-b-0 transition-colors cursor-pointer",
                        isExpanded ? "bg-muted/30" : "hover:bg-muted/50"
                      )}
                      onClick={() => setExpandedAssignment(isExpanded ? null : assignment.name)}
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
                            {assignment.name}
                          </p>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                assignment.completionRate === 100
                                  ? "bg-status-green"
                                  : assignment.completionRate >= 50
                                  ? "bg-status-yellow"
                                  : "bg-status-red"
                              )}
                              style={{ width: `${assignment.completionRate}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs font-medium text-muted-foreground">
                            {assignment.completionRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-status-green">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{assignment.completed}</span>
                          </div>
                          {assignment.late > 0 && (
                            <div className="flex items-center gap-1 text-xs text-status-yellow">
                              <Clock className="h-3 w-3" />
                              <span>{assignment.late}</span>
                            </div>
                          )}
                          {assignment.resubmit > 0 && (
                            <div className="flex items-center gap-1 text-xs text-status-orange">
                              <RotateCcw className="h-3 w-3" />
                              <span>{assignment.resubmit}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-status-red">
                            <XCircle className="h-3 w-3" />
                            <span>{assignment.uncompleted}</span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable student list */}
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
                              <AssignmentExpandedDetail
                                completed={studentsByAssignmentStatus.completed}
                                uncompleted={studentsByAssignmentStatus.uncompleted}
                                late={studentsByAssignmentStatus.late}
                                resubmit={studentsByAssignmentStatus.resubmit}
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

        {stats.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No assignment data available
          </p>
        )}

        <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-status-green" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-status-yellow" />
            <span>Late</span>
          </div>
          <div className="flex items-center gap-1.5">
            <RotateCcw className="h-3 w-3 text-status-orange" />
            <span>Resubmit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3 w-3 text-status-red" />
            <span>Uncompleted</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

type AssignmentTab = "uncompleted" | "late" | "resubmit" | "completed";

const ASSIGNMENT_TAB_CONFIG: Record<AssignmentTab, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
}> = {
  uncompleted: {
    label: "Uncompleted",
    icon: XCircle,
    colorClass: "text-status-red",
    bgClass: "bg-status-red/15 text-status-red",
  },
  late: {
    label: "Late",
    icon: Clock,
    colorClass: "text-status-yellow",
    bgClass: "bg-status-yellow/15 text-status-yellow",
  },
  resubmit: {
    label: "Resubmit",
    icon: RotateCcw,
    colorClass: "text-status-orange",
    bgClass: "bg-status-orange/15 text-status-orange",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    colorClass: "text-status-green",
    bgClass: "bg-status-green/15 text-status-green",
  },
};

function AssignmentExpandedDetail({
  completed,
  uncompleted,
  late,
  resubmit,
}: {
  completed: string[];
  uncompleted: string[];
  late: string[];
  resubmit: string[];
}) {
  const [activeTab, setActiveTab] = useState<AssignmentTab>(
    uncompleted.length > 0 ? "uncompleted" : late.length > 0 ? "late" : resubmit.length > 0 ? "resubmit" : "completed"
  );
  const allCompleted = uncompleted.length === 0 && late.length === 0 && resubmit.length === 0;

  const tabOrder: AssignmentTab[] = ["uncompleted", "late", "resubmit", "completed"];
  const lists: Record<AssignmentTab, string[]> = { completed, uncompleted, late, resubmit };
  const activeConfig = ASSIGNMENT_TAB_CONFIG[activeTab];
  const ActiveIcon = activeConfig.icon;
  const activeList = lists[activeTab];

  return (
    <div className="border-t-2 border-muted bg-muted/20 p-4">
      {allCompleted ? (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-status-green border rounded-md bg-card/50">
          <CheckCircle2 className="h-4 w-4" />
          All students completed!
        </div>
      ) : (
        <div>
          <div className="flex gap-1 mb-3 border-b border-border pb-2">
            {tabOrder.map(tabKey => {
              const config = ASSIGNMENT_TAB_CONFIG[tabKey];
              const count = lists[tabKey].length;
              if (count === 0) return null;
              const Icon = config.icon;
              const isActive = activeTab === tabKey;

              return (
                <button
                  key={tabKey}
                  onClick={(e) => { e.stopPropagation(); setActiveTab(tabKey); }}
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
                    isActive ? config.bgClass : "bg-muted"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1">
            {activeList.map((name, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-sm"
              >
                <ActiveIcon className={cn("h-3.5 w-3.5 shrink-0", activeConfig.colorClass)} />
                <span className="text-sm font-medium text-card-foreground truncate">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AssignmentOverview;
