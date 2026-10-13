import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData, useIssues, useSave } from '../hooks/data';
import type { Sprint } from '../types';
import { PageHeader, State, Badge } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import SprintModal from '../components/sprints/SprintModal';
import PlanningBoard from '../components/sprints/PlanningBoard';
import CompleteSprintModal from '../components/sprints/CompleteSprintModal';
export default function SprintPlanningPage() {
  const pid = Number(useParams().projectId);
  const query = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const issues = useIssues(pid);
  const [selectedId, setSelectedId] = useState<number>();
  const [modal, setModal] = useState<
    'create' | 'edit' | 'start' | 'complete' | null
  >(null);
  const selected =
    query.data?.find((s) => s.id === selectedId) ??
    query.data?.find((s) => s.status === 'ACTIVE') ??
    query.data?.[0];
  const remove = useSave(
    `/sprints/${selected?.id}`,
    'delete',
    'Sprint deleted',
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
                <>
                  <Button
                    variant="ghost"
                    disabled={remove.isPending}
                    onClick={async () => {
                      if (
                        window.confirm(
                          `Delete ${selected.name}? Its issues return to the backlog.`,
                        )
                      ) {
                        try {
                          await remove.mutateAsync({});
                          setSelectedId(undefined);
                        } catch {
                          /* toast */
                        }
                      }
                    }}
                  >
                    Delete
                  </Button>
                  <Button onClick={() => setModal('start')}>
                    Start sprint
                  </Button>
                </>
              )}
              {selected.status === 'ACTIVE' && (
                <>
                  <Button asChild variant="outline">
                    <Link to={`/projects/${pid}/board`}>View board</Link>
                  </Button>
                  <Button onClick={() => setModal('complete')}>
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
            zones={[selected]}
          />
        </>
      )}
      {modal === 'complete' && selected && (
        <CompleteSprintModal
          sprint={selected}
          sprints={query.data ?? []}
          issues={issues.data ?? []}
          onClose={() => setModal(null)}
        />
      )}
      {modal && modal !== 'complete' && (
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
