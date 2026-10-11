import { useParams, Link } from 'react-router-dom';
import { useData, useIssues } from '../hooks/data';
import type { Sprint } from '../types';
import { PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import KanbanBoard from '../components/board/KanbanBoard';
export default function BoardPage() {
  const pid = Number(useParams().projectId);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const query = useIssues(pid);
  const active = sprints.data?.find((s) => s.status === 'ACTIVE');
  const items =
    query.data?.filter(
      (i) => i.sprint_id === active?.id && i.issue_type !== 'EPIC',
    ) ?? [];
  return (
    <>
      <PageHeader
        title={active?.name ?? 'Active sprint board'}
        description={
          active
            ? `${active.goal} · ${active.start_date} — ${active.end_date} · ${items.reduce((n, i) => n + i.story_points, 0)} points`
            : 'Start a planned sprint to see your team’s work here.'
        }
      >
        <Button asChild variant="outline">
          <Link to={`/projects/${pid}/sprints`}>Sprint planning</Link>
        </Button>
      </PageHeader>
      <State
        loading={sprints.isLoading || query.isLoading}
        error={sprints.error || query.error}
      />
      {active ? (
        <KanbanBoard projectId={pid} issues={items} />
      ) : (
        !sprints.isLoading && (
          <section className="card empty">
            <h2>No active sprint</h2>
            <p>Plan a sprint, add issues, and start when your team is ready.</p>
          </section>
        )
      )}
    </>
  );
}
