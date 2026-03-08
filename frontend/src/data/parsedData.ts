// Types for parsed student data from HTML

export type ParsedStudentStatus = 
  | "Special Attention" 
  | "Lagging" 
  | "Ideal" 
  | "Ahead";

export type CourseStatus = "Completed" | "In Progress" | "Not Started";

export type AssignmentStatus = "Completed" | "Uncompleted" | "Late" | "Resubmit";

export type AttendanceStatus = "Attending" | "Late" | "Absent" | "Replaced" | "Off Cam" | "Abstract" | "Rejected";

export interface Attendance {
  event: string;
  status: AttendanceStatus;
}

export type CheckinMood = "good" | "neutral" | "bad";

export interface CheckinGoal {
  title: string;   // course name
  items: string[]; // topics learned
}

export interface DailyCheckin {
  date: string;            // e.g. "Sat, Feb 14, 2026"
  mood: CheckinMood;
  goals: CheckinGoal[];
  reflection: string;
}

export interface PointHistory {
  date: string;
  description: string;
  points: number;
}

export interface Assignment {
  name: string;
  status: AssignmentStatus;
}

export interface Course {
  name: string;
  progress: string; // e.g., "39%"
  status: CourseStatus;
}

export interface StudentProfile {
  university: string;
  major: string;
  photoUrl: string;
  profileLink: string;
}

export interface ParsedStudent {
  name: string;
  status: ParsedStudentStatus | null;
  courses: Course[];
  assignments?: Assignment[];
  attendances?: Attendance[];
  dailyCheckins?: DailyCheckin[];
  pointHistories?: PointHistory[];
  imageUrl?: string;
  profile?: StudentProfile;
  lastUpdatedDicoding?: string;
}

export interface MentorInfo {
  group: string;       // e.g. "CAC-19"
  mentorCode: string;  // e.g. "facil-cac-19"
  name: string;
}

export interface StudentData {
  students: ParsedStudent[];
  parsedAt: string; // ISO timestamp
  totalStudents: number;
  mentor?: MentorInfo;
}

// Status mapping from HTML to app format
export const statusMap: Record<string, ParsedStudentStatus> = {
  "Need Special Attention": "Special Attention",
  "Special Attention": "Special Attention",
  "Ideal": "Ideal",
  "Lagging": "Lagging",
  "Ahead": "Ahead",
  "On Track": "Ideal", // fallback mapping
};

// Helper function to map status
export const mapStatus = (htmlStatus: string | null): ParsedStudentStatus | null => {
  if (!htmlStatus) return null;
  return statusMap[htmlStatus] || null;
};

// Helper function to calculate average progress for a student
export const calculateAverageProgress = (courses: Course[]): number => {
  if (courses.length === 0) return 0;
  
  const total = courses.reduce((sum, course) => {
    const progress = parseFloat(course.progress.replace('%', ''));
    return sum + progress;
  }, 0);
  
  return Math.round(total / courses.length);
};

// Helper function to get status color class
export const getStatusColor = (status: ParsedStudentStatus | null): string => {
  switch (status) {
    case "Special Attention":
      return "status-red";
    case "Lagging":
      return "status-yellow";
    case "Ideal":
      return "status-green";
    case "Ahead":
      return "status-blue";
    default:
      return "text-muted-foreground";
  }
};

// Helper function to get course statistics
export const getCourseStats = (students: ParsedStudent[]) => {
  const courseMap = new Map<string, {
    totalEnrolled: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    totalProgress: number;
  }>();

  students.forEach(student => {
    student.courses.forEach(course => {
      if (!courseMap.has(course.name)) {
        courseMap.set(course.name, {
          totalEnrolled: 0,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
          totalProgress: 0,
        });
      }

      const stats = courseMap.get(course.name)!;
      stats.totalEnrolled++;
      stats.totalProgress += parseFloat(course.progress.replace('%', ''));

      if (course.status === "Completed") {
        stats.completed++;
      } else if (course.status === "In Progress") {
        stats.inProgress++;
      } else {
        stats.notStarted++;
      }
    });
  });

  return Array.from(courseMap.entries()).map(([name, stats]) => ({
    name,
    ...stats,
    averageProgress: Math.round(stats.totalProgress / stats.totalEnrolled),
    completionRate: Math.round((stats.completed / stats.totalEnrolled) * 100),
  }));
};

// Helper function to get status counts
export const getStatusCounts = (students: ParsedStudent[]) => {
  const counts: Record<ParsedStudentStatus, number> = {
    "Special Attention": 0,
    "Lagging": 0,
    "Ideal": 0,
    "Ahead": 0,
  };

  students.forEach(student => {
    if (student.status) {
      counts[student.status]++;
    }
  });

  return counts;
};

// Helper function to filter students by status
export const getStudentsByStatus = (
  students: ParsedStudent[],
  status: ParsedStudentStatus
) => {
  return students.filter(s => s.status === status);
};

// Helper function to get students enrolled in a specific course with their progress
export const getStudentsByCourse = (
  students: ParsedStudent[], 
  courseName: string
) => {
  return students
    .map(student => {
      const course = student.courses.find(c => c.name === courseName);
      if (!course) return null;
      
      return {
        studentName: student.name,
        studentStatus: student.status,
        courseProgress: parseFloat(course.progress.replace('%', '')),
        courseStatus: course.status,
        course: course,
      };
    })
    .filter(Boolean) as Array<{
      studentName: string;
      studentStatus: ParsedStudentStatus | null;
      courseProgress: number;
      courseStatus: CourseStatus;
      course: Course;
    }>;
};

// Helper function to get assignment statistics across all students
export const getAssignmentStats = (students: ParsedStudent[]) => {
  const assignmentMap = new Map<string, {
    totalStudents: number;
    completed: number;
    uncompleted: number;
    late: number;
    resubmit: number;
  }>();

  students.forEach(student => {
    (student.assignments || []).forEach(assignment => {
      if (!assignmentMap.has(assignment.name)) {
        assignmentMap.set(assignment.name, {
          totalStudents: 0,
          completed: 0,
          uncompleted: 0,
          late: 0,
          resubmit: 0,
        });
      }

      const stats = assignmentMap.get(assignment.name)!;
      stats.totalStudents++;
      if (assignment.status === 'Completed') {
        stats.completed++;
      } else if (assignment.status === 'Late') {
        stats.late++;
      } else if (assignment.status === 'Resubmit') {
        stats.resubmit++;
      } else {
        stats.uncompleted++;
      }
    });
  });

  return Array.from(assignmentMap.entries()).map(([name, stats]) => ({
    name,
    ...stats,
    completionRate: stats.totalStudents > 0
      ? Math.round((stats.completed / stats.totalStudents) * 100)
      : 0,
  }));
};

export interface AttendanceEventStats {
  event: string;
  totalStudents: number;
  attending: number;
  late: number;
  absent: number;
  replaced: number;
  offCam: number;
  abstract: number;
  rejected: number;
  attendanceRate: number;
}

export const getAttendanceStats = (students: ParsedStudent[]): AttendanceEventStats[] => {
  const eventMap = new Map<string, {
    totalStudents: number;
    attending: number;
    late: number;
    absent: number;
    replaced: number;
    offCam: number;
    abstract: number;
    rejected: number;
  }>();

  students.forEach(student => {
    (student.attendances || []).forEach(att => {
      if (!eventMap.has(att.event)) {
        eventMap.set(att.event, {
          totalStudents: 0,
          attending: 0,
          late: 0,
          absent: 0,
          replaced: 0,
          offCam: 0,
          abstract: 0,
          rejected: 0,
        });
      }

      const stats = eventMap.get(att.event)!;
      stats.totalStudents++;
      switch (att.status) {
        case 'Attending': stats.attending++; break;
        case 'Late': stats.late++; break;
        case 'Absent': stats.absent++; break;
        case 'Replaced': stats.replaced++; break;
        case 'Off Cam': stats.offCam++; break;
        case 'Abstract': stats.abstract++; break;
        case 'Rejected': stats.rejected++; break;
        default: stats.absent++; break;
      }
    });
  });

  return Array.from(eventMap.entries()).map(([event, stats]) => ({
    event,
    ...stats,
    attendanceRate: stats.totalStudents > 0
      ? Math.round(((stats.totalStudents - stats.absent - stats.abstract) / stats.totalStudents) * 100)
      : 0,
  }));
};

const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

const INDONESIAN_MONTH_MAP: Record<string, number> = {
  jan: 0,
  januari: 0,
  feb: 1,
  februari: 1,
  mar: 2,
  maret: 2,
  apr: 3,
  april: 3,
  mei: 4,
  jun: 5,
  juni: 5,
  jul: 6,
  juli: 6,
  agu: 7,
  agt: 7,
  ags: 7,
  agustus: 7,
  aug: 7,
  sep: 8,
  sept: 8,
  september: 8,
  okt: 9,
  oktober: 9,
  oct: 9,
  nov: 10,
  november: 10,
  des: 11,
  desember: 11,
  dec: 11,
  december: 11,
};

const toLocalDateOnly = (date: Date): Date => {
  const local = new Date(date);
  local.setHours(0, 0, 0, 0);
  return local;
};

export const getLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateByParts = (raw: string): Date | null => {
  // Formats: "20 Feb 2026", "20 February 2026", "Feb 20, 2026"
  const dayFirst = raw.match(/^(\d{1,2})[.\-/\s]+([A-Za-z]+)[.\-/\s,]+(\d{4})$/);
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const month = INDONESIAN_MONTH_MAP[dayFirst[2].toLowerCase()];
    const year = Number(dayFirst[3]);
    if (month !== undefined) return new Date(year, month, day);
  }

  const monthFirst = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthFirst) {
    const month = INDONESIAN_MONTH_MAP[monthFirst[1].toLowerCase()];
    const day = Number(monthFirst[2]);
    const year = Number(monthFirst[3]);
    if (month !== undefined) return new Date(year, month, day);
  }

  const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoLike) {
    return new Date(Number(isoLike[1]), Number(isoLike[2]) - 1, Number(isoLike[3]));
  }

  return null;
};

// Helper: parse check-in date robustly across timezone-sensitive and localized formats.
export const parseCheckinDate = (dateStr: string): Date => {
  const raw = (dateStr || '').trim();
  if (!raw) return new Date(NaN);

  const lowered = raw.toLowerCase();
  if (lowered === 'today' || lowered === 'hari ini') {
    return toLocalDateOnly(new Date());
  }
  if (lowered === 'yesterday' || lowered === 'kemarin') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return toLocalDateOnly(yesterday);
  }

  // Drop weekday prefix only for formats like "Thu, Feb 20, 2026"
  const commaCount = (raw.match(/,/g) || []).length;
  const cleaned = commaCount >= 2 ? raw.substring(raw.indexOf(',') + 1).trim() : raw;

  const parsedNative = new Date(cleaned);
  if (isValidDate(parsedNative)) return parsedNative;

  const parsedByParts = parseDateByParts(cleaned) || parseDateByParts(raw);
  if (parsedByParts && isValidDate(parsedByParts)) return parsedByParts;

  return new Date(NaN);
};

export const getCheckinDateKey = (dateStr: string): string | null => {
  const parsed = parseCheckinDate(dateStr);
  if (!isValidDate(parsed)) return null;
  return getLocalDateKey(toLocalDateOnly(parsed));
};

// Helper function to get daily check-in statistics across all students
export const getCheckinStats = (students: ParsedStudent[]) => {
  let totalCheckins = 0;
  let moodGood = 0;
  let moodNeutral = 0;
  let moodBad = 0;
  const missingStudents: string[] = [];
  const streaks: { name: string; streak: number }[] = [];

  students.forEach(student => {
    const checkins = student.dailyCheckins || [];
    totalCheckins += checkins.length;

    if (checkins.length === 0) {
      missingStudents.push(student.name);
      streaks.push({ name: student.name, streak: 0 });
      return;
    }

    checkins.forEach(ci => {
      if (ci.mood === 'good') moodGood++;
      else if (ci.mood === 'neutral') moodNeutral++;
      else moodBad++;
    });

    // Calculate streak (consecutive days from most recent)
    const sortedDates = Array.from(
      new Set(
        checkins
          .map(ci => parseCheckinDate(ci.date))
          .filter(isValidDate)
          .map(d => toLocalDateOnly(d).getTime())
      )
    ).sort((a, b) => b - a); // newest first

    if (sortedDates.length === 0) {
      streaks.push({ name: student.name, streak: 0 });
      return;
    }

    let streak = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const diff = sortedDates[i - 1] - sortedDates[i];
      if (diff <= 86400000 * 1.5) { // ~1.5 days to handle timezone variance
        streak++;
      } else {
        break;
      }
    }
    streaks.push({ name: student.name, streak });
  });

  streaks.sort((a, b) => b.streak - a.streak);

  return {
    totalCheckins,
    moodGood,
    moodNeutral,
    moodBad,
    missingStudents,
    streaks,
  };
};

// Helper function to get heatmap data for the check-in calendar
export const getCheckinHeatmapData = (students: ParsedStudent[]) => {
  const today = toLocalDateOnly(new Date());
  const maxDateVal = today.getTime();
  let minDateVal = maxDateVal;

  students.forEach(student => {
    (student.dailyCheckins || []).forEach(ci => {
      const d = parseCheckinDate(ci.date);
      if (!isValidDate(d)) return;
      const time = toLocalDateOnly(d).getTime();
      if (time < minDateVal) minDateVal = time;
    });
  });
  
  // Ensure minDate is not in the future (fallback to 2 weeks ago if no data)
  if (minDateVal > maxDateVal) {
    minDateVal = maxDateVal - (14 * 24 * 60 * 60 * 1000); 
  }

  // 3. Generate continuous date array
  const allDates: string[] = [];
  const currentDate = new Date(minDateVal);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate.getTime() <= maxDateVal) {
    allDates.push(getLocalDateKey(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 4. Build rows
  const rows = students.map(student => {
    const checkinMap = new Map<string, DailyCheckin>();
    (student.dailyCheckins || []).forEach(ci => {
      const dateKey = getCheckinDateKey(ci.date);
      if (!dateKey) return;
      checkinMap.set(dateKey, ci);
    });

    return {
      name: student.name,
      cells: allDates.map(date => {
        const checkin = checkinMap.get(date);
        return {
          date,
          hasCheckin: !!checkin,
          mood: checkin?.mood || null,
          goals: checkin?.goals || [],
          reflection: checkin?.reflection || "",
        };
      }),
    };
  });

  return { dates: allDates, rows };
};
