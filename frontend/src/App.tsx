import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StudentDataProvider } from "@/contexts/StudentDataContext";
import UploadPage from "./pages/UploadPage";
import Dashboard from "./pages/Dashboard";
import HomePage from "./pages/HomePage";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "@/components/theme-provider";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="dicodex-ui-theme">
    <QueryClientProvider client={queryClient}>
      <StudentDataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/home" element={<HomePage />} />
              <Route path="/" element={<UploadPage />} />
              <Route path="/dashboard" element={<Dashboard />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </StudentDataProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
