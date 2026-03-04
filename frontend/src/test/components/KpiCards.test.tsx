import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import KpiCards from "@/components/dashboard/KpiCards";
import type { ParsedStudent } from "@/data/parsedData";

// Minimal student factory
const makeStudent = (
  name: string,
  status: ParsedStudent["status"]
): ParsedStudent => ({
  name,
  status,
  courses: [{ name: "Course A", progress: "50%", status: "In Progress" }],
});

const mockStudents: ParsedStudent[] = [
  makeStudent("Alice", "Ideal"),
  makeStudent("Bob", "Lagging"),
  makeStudent("Charlie", "Ahead"),
  makeStudent("Dave", "Special Attention"),
  makeStudent("Eve", "Ideal"),
];

describe("KpiCards", () => {
  it("renders all 4 KPI cards", () => {
    render(<KpiCards students={mockStudents} />);
    expect(screen.getByText("Need Special Attention")).toBeInTheDocument();
    expect(screen.getByText("Lagging Behind")).toBeInTheDocument();
    expect(screen.getByText("On Ideal Schedule")).toBeInTheDocument();
    expect(screen.getByText("Ahead of Schedule")).toBeInTheDocument();
  });

  it("displays correct count numbers", () => {
    render(<KpiCards students={mockStudents} />);
    // 2 Ideal, 1 Lagging, 1 Ahead, 1 Special Attention
    const counts = screen.getAllByText(/^\d+$/);
    const numberTexts = counts.map((el) => el.textContent);
    expect(numberTexts).toContain("2"); // Ideal
    expect(numberTexts).toContain("1"); // Lagging, Ahead, Special Attention
  });

  it("renders with empty students list (all zeros)", () => {
    render(<KpiCards students={[]} />);
    // All 4 counts should show 0
    const counts = screen.getAllByText("0");
    expect(counts.length).toBe(4);
  });

  it("renders without crashing when students have null status", () => {
    const students: ParsedStudent[] = [
      { name: "Anon", status: null, courses: [] },
    ];
    expect(() => render(<KpiCards students={students} />)).not.toThrow();
  });
});
