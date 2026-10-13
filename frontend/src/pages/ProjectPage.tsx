import { Link, useParams } from 'react-router-dom';
import { useData, useIssues } from '../hooks/data';
import { statuses, type Project, type Sprint } from '../types';
import { percent } from '../lib/qa';
import { PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { Kpi, Progress } from '../components/ui/charts';
import { useCreateIssue } from '../components/layout/AppShell';
import IssueTable from '../components/issues/IssueTable';
import IssueCharts from '../components/issues/IssueCharts';

export default function ProjectPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const query = useData<Project>(`/projects/${pid}`);
  const issues = useIssues(pid);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const create = useCreateIssue();
  const p = query.data;
  if (!p) return <State loading={query.isLoading} error={query.error} />;
  const all = issues.data ?? [];
  const work = all.filter((i) => i.issue_type !== 'EPIC');
  const epics = all.filter((i) => i.issue_type === 'EPIC');
  const active = sprints.data?.find((s) => s.status === 'ACTIVE');
  const next = sprints.data
    ?.filter((s) => s.status === 'PLANNED')
    .sort((a, b) => a.id - b.id)[0];
  const sprintItems = work.filter((i) => i.sprint_id === active?.id);
  const kanban = p.board_type === 'KANBAN';
  return (
    <>
      <PageHeader
        title="Overview"
        description={p.description || 'No description yet.'}
      >
        <Button asChild variant="outline">
          <Link to={`/projects/${p.id}/backlog`}>Open backlog</Link>
        </Button>
        <Button onClick={() => create({ project_id: p.id })}>
          + Create issue
        </Button>
      </PageHeader>
      <State loading={issues.isLoading} error={issues.error} />
      <div className="kpis">
        <Kpi
          name="Open work items"
          value={work.filter((i) => i.status !== 'DONE').length}
          hint={`${work.length} total`}
        />
        <Kpi
          name="In progress"
          value={
            work.filter((i) =>
              ['IN_PROGRESS', 'CODE_REVIEW', 'TESTING'].includes(i.status),
            ).length
          }
          tone="warn"
        />
        <Kpi
          name="Done"
          value={work.filter((i) => i.status === 'DONE').length}
          tone="good"
        />
        <Kpi
          name="Open bugs"
          value={
            work.filter((i) => i.issue_type === 'BUG' && i.status !== 'DONE')
              .length
          }
          tone="bad"
        />
      </div>
      <div className="chart-grid-2">
        <section className="card">
          <div className="section-head">
            <h2>
              {kanban
                ? 'Kanban flow'
                : active
                  ? `Active sprint · ${active.name}`
                  : 'No active sprint'}
            </h2>
            <Button asChild variant="outline">
              <Link to={`/projects/${p.id}/board`}>Open board</Link>
            </Button>
          </div>
          {kanban || active ? (
            <>
              {active && !kanban && (
                <p className="muted">
                  {active.goal || 'No goal set'} · {active.start_date} —{' '}
                  {active.end_date} ·{' '}
                  {sprintItems
                    .filter((i) => i.status === 'DONE')
                    .reduce((n, i) => n + i.story_points, 0)}{' '}
                  of {sprintItems.reduce((n, i) => n + i.story_points, 0)}{' '}
                  points done
                </p>
              )}
              <Progress
                rows={statuses.map((s) => ({
                  key: s,
                  count: (kanban ? work : sprintItems).filter(
                    (i) => i.status === s,
                  ).length,
                }))}
              />
            </>
          ) : (
            <p className="muted">
              {next
                ? `${next.name} is planned. Start it from the backlog when the team is ready.`
                : 'Create a sprint in the backlog to start planning.'}
            </p>
          )}
        </section>
        <section className="card">
          <div className="section-head">
            <h2>Epics</h2>
            <Link to={`/projects/${p.id}/epics`}>View all →</Link>
          </div>
          {!epics.length && <p className="muted">No epics yet.</p>}
          {epics.slice(0, 5).map((e) => {
            const items = all.filter((i) => i.epic_id === e.id);
            const done = items.filter((i) => i.status === 'DONE').length;
            return (
              <div className="chart-row" key={e.id}>
                <Link to={`/issues/${e.id}`}>{e.summary}</Link>
                <div className="bar-track">
                  <div
                    className="bar bar-done"
                    style={{ width: `${percent(done, items.length)}%` }}
                  />
                </div>
                <strong>{percent(done, items.length)}%</strong>
              </div>
            );
          })}
        </section>
      </div>
      <div className="dashboard-detail">
        <section className="card">
          <div className="section-head">
            <h2>Recently updated</h2>
            <Link to={`/projects/${p.id}/work-items`}>All work items →</Link>
          </div>
          <IssueTable
            issues={[...all]
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
              .slice(0, 8)}
          />
        </section>
        <IssueCharts issues={work} />
      </div>
    </>
  );
}
