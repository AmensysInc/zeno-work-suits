import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData, useIssues } from '../hooks/data';
import type { Sprint } from '../types';
import { PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { useCreateIssue } from '../components/layout/AppShell';
import IssueTable from '../components/issues/IssueTable';
import SprintModal from '../components/sprints/SprintModal';
import PlanningBoard from '../components/sprints/PlanningBoard';
export default function BacklogPage() {
  const pid = Number(useParams().projectId);
  const query = useIssues(pid);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const create = useCreateIssue();
  const [modal, setModal] = useState<Sprint | 'new' | null>(null);
  const [planning, setPlanning] = useState<number | null>(null);
  const openSprints =
    sprints.data?.filter((s) => s.status !== 'COMPLETED') ?? [];
  const selected = openSprints.find((s) => s.id === planning);
  const issues = query.data ?? [];
  return (
    <>
      <PageHeader
        title="Product Backlog"
        description="Organize epics, stories, bugs and tasks before sprint planning."
      >
        <Button variant="outline" onClick={() => setModal('new')}>
          + Create sprint
        </Button>
        <Button onClick={() => create({ project_id: pid })}>
          + Create issue
        </Button>
      </PageHeader>
      <State
        loading={query.isLoading || sprints.isLoading}
        error={query.error || sprints.error}
      />
      {openSprints.map((s) => {
        const items = issues.filter((i) => i.sprint_id === s.id);
        return (
          <section className="card sprint-summary" key={s.id}>
            <div>
              <h3>{s.name}</h3>
              <p>Goal: {s.goal || 'No goal set'}</p>
              <p>
                {items.length} issues ·{' '}
                {items.reduce((n, i) => n + i.story_points, 0)} story points ·{' '}
                {s.start_date ?? 'Not scheduled'} — {s.end_date ?? ''}
              </p>
            </div>
            <div className="actions">
              <Button
                variant="outline"
                onClick={() => setPlanning(planning === s.id ? null : s.id)}
              >
                {planning === s.id ? 'Close planning' : 'Plan issues'}
              </Button>
              {s.status === 'PLANNED' ? (
                <Button onClick={() => setModal(s)}>Start sprint</Button>
              ) : (
                <Button asChild>
                  <Link to={`/projects/${pid}/board`}>Open board</Link>
                </Button>
              )}
            </div>
          </section>
        );
      })}
      {selected && (
        <PlanningBoard
          projectId={pid}
          issues={issues}
          sprints={sprints.data ?? []}
          selected={selected}
        />
      )}
      <p className="backlog-note">
        Group work by epic. Use “Plan issues” to drag and reorder work between
        the backlog and a sprint.
      </p>
      {[...issues.filter((i) => i.issue_type === 'EPIC'), null].map((epic) => {
        const items = issues.filter(
          (i) =>
            i.issue_type !== 'EPIC' &&
            i.epic_id === (epic?.id ?? null) &&
            i.status !== 'DONE',
        );
        if (!items.length && !epic) return null;
        return (
          <section className="card" key={epic?.id ?? 'none'}>
            <div className="section-head">
              <h3 className="epic">
                {epic ? (
                  <Link to={`/issues/${epic.id}`}>EPIC · {epic.summary}</Link>
                ) : (
                  'Ungrouped issues'
                )}
              </h3>
              <span className="muted">{items.length} items</span>
            </div>
            <IssueTable issues={items} sprints={sprints.data ?? []} />
          </section>
        );
      })}
      {issues.length === 0 && <State empty />}
      {modal && (
        <SprintModal
          projectId={pid}
          sprint={modal === 'new' ? undefined : modal}
          start={modal !== 'new'}
          issues={issues.filter(
            (i) => i.sprint_id === (modal === 'new' ? null : modal.id),
          )}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
