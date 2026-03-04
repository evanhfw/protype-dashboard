import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StudentGrid from "@/components/dashboard/StudentGrid";
import { TooltipProvider } from "@/components/ui/tooltip";

// StudentGrid uses static imported data — wrap in TooltipProvider to avoid
// Radix UI warnings about tooltip context
const renderStudentGrid = () =>
  render(
    <TooltipProvider>
      <StudentGrid />
    </TooltipProvider>
  );

describe("StudentGrid", () => {
  it("renders without crashing", () => {
    expect(() => renderStudentGrid()).not.toThrow();
  });

  it("renders the section title", () => {
    renderStudentGrid();
    expect(screen.getByText("Student Overview")).toBeInTheDocument();
  });

  it("shows the student count in the header", () => {
    renderStudentGrid();
    // Format is "(N students)" in a span
    const countEl = screen.getByText(/\d+ students?/);
    expect(countEl).toBeInTheDocument();
  });

  it("renders at least one student card", () => {
    renderStudentGrid();
    // Each student card shows a student name — check that grid has children
    // The grid renders student names as text; we just verify there are elements
    const grid = document.querySelector(".grid");
    expect(grid).not.toBeNull();
    expect(grid!.children.length).toBeGreaterThan(0);
  });
});
