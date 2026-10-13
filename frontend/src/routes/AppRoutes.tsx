import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ProjectsPage = lazy(() => import('../pages/ProjectsPage'));
const ProjectPage = lazy(() => import('../pages/ProjectPage'));
const BacklogPage = lazy(() => import('../pages/BacklogPage'));
const IssueDetailsPage = lazy(() => import('../pages/IssueDetailsPage'));
const SprintPlanningPage = lazy(() => import('../pages/SprintPlanningPage'));
const BoardPage = lazy(() => import('../pages/BoardPage'));
const TestCasesPage = lazy(() => import('../pages/TestCasesPage'));
const AddTestCasePage = lazy(() => import('../pages/AddTestCasePage'));
const TestCaseDetailsPage = lazy(() => import('../pages/TestCaseDetailsPage'));
const QaDashboardPage = lazy(() => import('../pages/QaDashboardPage'));
const QaBoardPage = lazy(() => import('../pages/QaBoardPage'));
const BugsPage = lazy(() => import('../pages/BugsPage'));
const TraceabilityPage = lazy(() => import('../pages/TraceabilityPage'));
const WorkItemsPage = lazy(() => import('../pages/WorkItemsPage'));
const EpicsPage = lazy(() => import('../pages/EpicsPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const ProjectSettingsPage = lazy(() => import('../pages/ProjectSettingsPage'));
const MyIssuesPage = lazy(() => import('../pages/MyIssuesPage'));
const VoiceAgentPage = lazy(() => import('../pages/VoiceAgentPage'));
// Reads the token on every render so a fresh sign-in is seen immediately.
function RequireAuth() {
  return localStorage.getItem('trackly_token') ? (
    <AppShell />
  ) : (
    <Navigate to="/login" replace />
  );
}
export default function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="empty" role="status">
          Loading�
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route
            path="/projects/:projectId/backlog"
            element={<BacklogPage />}
          />
          <Route
            path="/projects/:projectId/work-items"
            element={<WorkItemsPage />}
          />
          <Route path="/projects/:projectId/epics" element={<EpicsPage />} />
          <Route
            path="/projects/:projectId/test-cases"
            element={<TestCasesPage />}
          />
          <Route
            path="/projects/:projectId/reports"
            element={<ReportsPage />}
          />
          <Route
            path="/projects/:projectId/settings"
            element={<ProjectSettingsPage />}
          />
          <Route path="/issues/:issueId" element={<IssueDetailsPage />} />
          <Route
            path="/projects/:projectId/sprints"
            element={<SprintPlanningPage />}
          />
          <Route path="/projects/:projectId/board" element={<BoardPage />} />
          <Route
            path="/projects/:projectId/quality"
            element={<QaDashboardPage />}
          />
          <Route
            path="/projects/:projectId/test-runs"
            element={<QaBoardPage />}
          />
          <Route path="/projects/:projectId/bugs" element={<BugsPage />} />
          <Route
            path="/projects/:projectId/traceability"
            element={<TraceabilityPage />}
          />
          <Route path="/test-cases" element={<TestCasesPage />} />
          <Route path="/test-cases/new" element={<AddTestCasePage />} />
          <Route
            path="/test-cases/:testCaseId"
            element={<TestCaseDetailsPage />}
          />
          <Route path="/my-issues" element={<MyIssuesPage />} />
          <Route path="/voice-agent" element={<VoiceAgentPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
