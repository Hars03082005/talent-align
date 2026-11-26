// frontend/src/App.tsx

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProvider, useUser } from './store/userContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { CopilotDrawer } from './components/CopilotDrawer';

// Application Screens
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { RoleDetailPage } from './pages/RoleDetailPage';
import { ExplorerPage } from './pages/ExplorerPage';
import { JobsPage } from './pages/JobsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

// ─── App Shell (Sidebar + Navbar + CopilotDrawer) ────────────────────────────
const AppShell: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => {
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [currentRoleId, setCurrentRoleId] = useState<string | undefined>(undefined);
  const { userId, sessionId } = useUser();

  // Expose setCurrentRoleId via a simple data attr on the shell element so
  // RoleDetailPage can signal it (optional wiring — no-op if not used).
  void setCurrentRoleId;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900 selection:bg-indigo-600 selection:text-white">
      {/* Fixed Left Sidebar */}
      <Sidebar />

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <Navbar title={title} onOpenCopilot={() => setCopilotOpen(true)} />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Global Copilot Slide-over */}
      <CopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        userId={userId}
        sessionId={sessionId}
        currentRoleId={currentRoleId}
      />
    </div>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────
export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <BrowserRouter>
          <Routes>
            {/* Default → My Matches */}
            <Route path="/" element={<Navigate to="/matches" replace />} />

            {/* Onboarding (Resume & BAIO Profile) */}
            <Route
              path="/onboarding"
              element={
                <AppShell title="Resume & BAIO Profile">
                  <OnboardingPage />
                </AppShell>
              }
            />

            {/* My Matches Dashboard */}
            <Route
              path="/matches"
              element={
                <AppShell title="My Matches">
                  <DashboardPage />
                </AppShell>
              }
            />

            {/* Role Deep Dive */}
            <Route
              path="/roles/:roleId"
              element={
                <AppShell title="Role Deep Dive">
                  <RoleDetailPage />
                </AppShell>
              }
            />

            {/* Market Explorer */}
            <Route
              path="/explorer"
              element={
                <AppShell title="Market Explorer">
                  <ExplorerPage />
                </AppShell>
              }
            />

            {/* Job Intelligence */}
            <Route
              path="/jobs"
              element={
                <AppShell title="Job Intelligence">
                  <JobsPage />
                </AppShell>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/matches" replace />} />
          </Routes>
        </BrowserRouter>
      </UserProvider>
    </QueryClientProvider>
  );
};

export default App;
