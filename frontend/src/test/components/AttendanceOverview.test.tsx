import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AttendanceOverview from "@/components/dashboard/AttendanceOverview";
import type { ParsedStudent } from "@/data/parsedData";

// Helper to create test students with attendance data
const makeStudentWithAttendance = (
  name: string,
  attendances: { event: string; status: "Attending" | "Absent" | "Late" | "Replaced" | "Off Cam" }[]
): ParsedStudent => ({
  name,
  status: "Ideal",
  courses: [],
  attendances,
});

const studentsWithAttendance: ParsedStudent[] = [
  makeStudentWithAttendance("Alice", [
    { event: "Webinar 1", status: "Attending" },
    { event: "Webinar 2", status: "Absent" },
  ]),
  makeStudentWithAttendance("Bob", [
    { event: "Webinar 1", status: "Late" },
    { event: "Webinar 2", status: "Attending" },
  ]),
  makeStudentWithAttendance("Charlie", [
    { event: "Webinar 1", status: "Attending" },
    { event: "Webinar 2", status: "Attending" },
  ]),
];

describe("AttendanceOverview", () => {
  it("renders without crashing", () => {
    expect(() =>
      render(<AttendanceOverview students={studentsWithAttendance} />)
    ).not.toThrow();
  });

  it("renders the section title", () => {
    render(<AttendanceOverview students={studentsWithAttendance} />);
    expect(screen.getByText("Attendance Overview")).toBeInTheDocument();
  });

  it("shows summary stats (Total Events, Avg Attendance, Full Attendance)", () => {
    render(<AttendanceOverview students={studentsWithAttendance} />);
    expect(screen.getByText("Total Events")).toBeInTheDocument();
    expect(screen.getByText("Avg Attendance")).toBeInTheDocument();
    expect(screen.getByText("Full Attendance")).toBeInTheDocument();
  });

  it("renders correct total event count", () => {
    render(<AttendanceOverview students={studentsWithAttendance} />);
    // 2 events: Webinar 1, Webinar 2 — find the Total Events stat card specifically
    const totalEventsLabel = screen.getByText("Total Events");
    const statCard = totalEventsLabel.closest("div")!.parentElement!;
    expect(statCard.querySelector(".text-2xl")?.textContent).toBe("2");
  });

  it("renders event names in the table", () => {
    render(<AttendanceOverview students={studentsWithAttendance} />);
    expect(screen.getByText("Webinar 1")).toBeInTheDocument();
    expect(screen.getByText("Webinar 2")).toBeInTheDocument();
  });

  it("renders attendance rate percentages", () => {
    render(<AttendanceOverview students={studentsWithAttendance} />);
    // Webinar 1: 3 students, 0 absent → 100% attendance rate
    // Webinar 2: 3 students, 1 absent → 67% attendance rate
    const percentages = screen.getAllByText(/%$/);
    expect(percentages.length).toBeGreaterThan(0);
  });

  it("returns null (renders nothing) when there are no attendance records", () => {
    const { container } = render(
      <AttendanceOverview students={[{ name: "A", status: "Ideal", courses: [] }]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders legend with all status labels", () => {
    render(<AttendanceOverview students={studentsWithAttendance} />);
    expect(screen.getByText("Attending")).toBeInTheDocument();
    expect(screen.getByText("Late")).toBeInTheDocument();
    expect(screen.getByText("Absent")).toBeInTheDocument();
    expect(screen.getByText("Replaced")).toBeInTheDocument();
    expect(screen.getByText("Off Cam")).toBeInTheDocument();
  });
});
