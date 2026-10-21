import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useProjects } from '../hooks/data';
import { PageHeader, State } from '../components/ui/shared';
import TestCaseList from '../components/testing/TestCaseList';
import SharedStepsLibrary from '../components/testing/SharedStepsLibrary';
import { useCurrentProject } from '../components/layout/AppShell';
export default function TestCasesPage() {
  const projects = useProjects();
  const current = useCurrentProject();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  // Inside a project the route owns the project; the global page uses ?project=.
  const routeProject = Number(useParams().projectId) || undefined;
  const projectId = routeProject ?? (Number(params.get('project')) || current);
  const tab = params.get('tab') === 'steps' ? 'steps' : 'tests';
  const set = (key: string, value: string) => {
    if (routeProject && key === 'project') {
      nav(`/projects/${value}/test-cases?${params}`);
      return;
    }
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true });
  };
  return (
    <>
      <PageHeader
        title="Test Repository"
        description="Every test case and reusable step, organized by project."
      >
        <select
          aria-label="Project"
          value={projectId ?? ''}
          onChange={(e) => set('project', e.target.value)}
        >
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </PageHeader>
      <div className="tabs">
        <button
          className={tab === 'tests' ? 'selected' : ''}
          onClick={() => set('tab', 'tests')}
        >
          Test cases
        </button>
        <button
          className={tab === 'steps' ? 'selected' : ''}
          onClick={() => set('tab', 'steps')}
        >
          Reusable steps
        </button>
      </div>
      {!projectId ? (
        <State
          loading={projects.isLoading}
          error={projects.error}
          empty={!projects.isLoading}
        />
      ) : tab === 'steps' ? (
        <SharedStepsLibrary key={projectId} projectId={projectId} />
      ) : (
        <TestCaseList key={projectId} projectId={projectId} />
      )}
    </>
  );
}
