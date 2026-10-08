import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData, useIssues, useSave } from '../hooks/data';
import type { Sprint } from '../types';
import { PageHeader, State, Badge } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import SprintModal from '../components/sprints/SprintModal';
import PlanningBoard from '../components/sprints/PlanningBoard';
export default function SprintPlanningPage() {
  const pid = Number(useParams().projectId);
  const query = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const issues = useIssues(pid);
  const [selectedId, setSelectedId] = useState<number>();
  const [modal, setModal] = useState<'create' | 'edit' | 'start' | null>(null);
  const selected =
    query.data?.find((s) => s.id === selectedId) ??
    query.data?.find((s) => s.status === 'ACTIVE') ??
    query.data?.[0];
  const complete = useSave(
    `/sprints/${selected?.id}/complete`,
    'post',
    'Sprint completed',
  );
  const sprintIssues =
    issues.data?.filter((i) => i.sprint_id === selected?.id) ?? [];
  return (
    <>
      <PageHeader
        title="Sprint planning"
        description="Give your team a clear goal and a focused set of work."
      >
        <Button onClick={() => setModal('create')}>+ Create sprint</Button>
      </PageHeader>
      <State
        loading={query.isLoading || issues.isLoading}
        error={query.error || issues.error}
        empty={query.data?.length === 0}
      />
      {selected && (
        <>
          <section className="card sprint-summary">
            <div>
              <select
                aria-label="Select sprint"
                className="sprint-select"
                value={selected.id}
                onChange={(e) => setSelectedId(Number(e.target.value))}
              >
                {query.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p>{selected.goal}</p>
              <p>
                {selected.start_date ?? 'No dates'} —{' '}
                {selected.end_date ?? 'Not set'} ·{' '}
                {sprintIssues.reduce((n, i) => n + i.story_points, 0)} /{' '}
                {selected.capacity} story points
              </p>
            </div>
            <div className="actions">
              <Badge value={selected.status} />
              {selected.status !== 'COMPLETED' && (
                <Button variant="outline" onClick={() => setModal('edit')}>
                  Edit
                </Button>
              )}
              {selected.status === 'PLANNED' && (
                <Button onClick={() => setModal('start')}>Start sprint</Button>
              )}
              {selected.status === 'ACTIVE' && (
                <>
                  <Button asChild variant="outline">
                    <Link to={`/projects/${pid}/board`}>View board</Link>
                  </Button>
                  <Button
                    disabled={complete.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          'Complete sprint? Unfinished issues will return to the backlog.',
                        )
                      )
                        complete.mutate({});
                    }}
                  >
                    Complete sprint
                  </Button>
                </>
              )}
            </div>
          </section>
          <PlanningBoard
            projectId={pid}
            issues={issues.data ?? []}
            sprints={query.data ?? []}
            selected={selected}
          />
        </>
      )}
      {modal && (
        <SprintModal
          projectId={pid}
          sprint={modal === 'create' ? undefined : selected}
          start={modal === 'start'}
          issues={sprintIssues}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
