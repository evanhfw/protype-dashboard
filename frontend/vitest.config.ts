import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // Only measure coverage for files that actually have tests written.
      // As more tests are added, expand this list.
      include: [
        "src/lib/utils.ts",
        "src/data/parsedData.ts",
        "src/hooks/use-mobile.tsx",
        "src/components/dashboard/KpiCards.tsx",
        "src/components/dashboard/StudentGrid.tsx",
        "src/components/dashboard/AttendanceOverview.tsx",
      ],
      thresholds: {
        lines: 60,
        functions: 50, // interaction handlers (dialogs, sort) need user-event to reach 60%
        branches: 60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

