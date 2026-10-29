'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useProjects } from '@/hooks/data';
import { PageBar, PageBody } from '@/components/layout/page';
import { useCurrentProject } from '@/components/layout/context';
import { LinkButton } from '@/components/ui/button';
import { State } from '@/components/ui/display';
import { Tabs } from '@/components/ui/controls';
import { Select } from '@/components/ui/select';
import TestCaseList from '@/components/testing/test-case-list';
import SharedStepsLibrary from '@/components/testing/shared-steps';

/** Test cases and reusable steps; inside a project the route owns the project, the global page uses ?project=. */
export default function TestRepository() {
  const projects = useProjects();
  const current = useCurrentProject();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const routeProject = Number(useParams<{ projectId?: string }>().projectId) || undefined;
  const projectId = routeProject ?? (Number(params.get('project')) || current || projects.data?.[0]?.id);
  // Put a fallback project in the URL so the sidebar switcher shows it too.
  useEffect(() => {
    if (!routeProject && projectId && !params.get('project')) {
      const next = new URLSearchParams(params);
      next.set('project', String(projectId));
      router.replace(`${pathname}?${next}`);
    }
  }, [params, projectId, routeProject, router, pathname]);
  const tab = params.get('tab') === 'steps' ? 'steps' : 'tests';
  const set = (key: string, value: string) => {
    if (routeProject && key === 'project') {
      router.push(`/projects/${value}/test-cases?${params}`);
      return;
    }
    const next = new URLSearchParams(params);
    next.set(key, value);
    router.replace(`${pathname}?${next}`);
  };
  return (
    <>
      <PageBar
        crumbs={['Test repository']}
        projectId={routeProject}
        actions={
          <>
            {!routeProject && (
              <Select<number>
                aria-label="Project"
                className="w-48"
                value={projectId}
                onChange={(v) => set('project', String(v))}
                options={(projects.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
              />
            )}
            <LinkButton variant="primary" href="/test-cases/new" icon={<Plus className="size-3.5" />}>
              <span className="hidden sm:inline">Add test case</span>
            </LinkButton>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={(v) => set('tab', v)}
        items={[
          { key: 'tests', label: 'Test cases' },
          { key: 'steps', label: 'Reusable steps' },
        ]}
      />
      <PageBody padded={false}>
        {!projectId ? (
          <State loading={projects.isLoading} error={projects.error} empty={!projects.isLoading} emptyText="Create a project to start a test repository." />
        ) : tab === 'steps' ? (
          <SharedStepsLibrary key={projectId} projectId={projectId} />
        ) : (
          <TestCaseList key={projectId} projectId={projectId} />
        )}
      </PageBody>
    </>
  );
}
