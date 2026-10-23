import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Tabs } from 'antd';
import { useProjects } from '../hooks/data';
import { Select } from '../components/ui/form';
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
        <Select
          aria-label="Project"
          className="inline-select"
          value={projectId}
          onChange={(v) => set('project', v)}
          options={(projects.data ?? []).map((p) => ({
            value: p.id,
            label: p.name,
          }))}
        />
      </PageHeader>
      <Tabs
        activeKey={tab}
        onChange={(v) => set('tab', v)}
        items={[
          { key: 'tests', label: 'Test cases' },
          { key: 'steps', label: 'Reusable steps' },
        ]}
      />
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
