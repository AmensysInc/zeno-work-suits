import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData, useIssues } from '../hooks/data';
import type { Project, Sprint } from '../types';
import { PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { useCreateIssue } from '../components/layout/AppShell';
import IssueTable from '../components/issues/IssueTable';
import WorkItemFilters, {
  useFilters,
} from '../components/issues/WorkItemFilters';
import BulkActions from '../components/issues/BulkActions';
import SprintModal from '../components/sprints/SprintModal';
import PlanningBoard from '../components/sprints/PlanningBoard';
import CompleteSprintModal from '../components/sprints/CompleteSprintModal';

const sprintOrder = (a: Sprint, b: Sprint) =>
  Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') ||
  (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999') ||
  a.id - b.id;

export default function BacklogPage() {
  const pid = Number(useParams().projectId);
  const project = useData<Project>(`/projects/${pid}`);
  const query = useIssues(pid);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const create = useCreateIssue();
  const filters = useFilters();
  const [view, setView] = useState<'plan' | 'epics'>('plan');
  const [showDone, setShowDone] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<{
    kind: 'new' | 'edit' | 'start' | 'complete';
    sprint?: Sprint;
  } | null>(null);
  const kanban = project.data?.board_type === 'KANBAN';
  const all = sprints.data ?? [];
  const openSprints = all
    .filter((s) => s.status !== 'COMPLETED')
    .sort(sprintOrder);
  const issues = query.data ?? [];
  const epics = issues.filter((i) => i.issue_type === 'EPIC');
  const members = project.data?.members ?? [];
  const visible = (i: (typeof issues)[number]) =>
    filters.matches(i) && (showDone || i.status !== 'DONE');
  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const inFlow = issues.filter(
    (i) =>
      i.issue_type !== 'EPIC' &&
      !['BACKLOG', 'DONE'].includes(i.status) &&
      filters.matches(i),
  );
  return (
    <>
      <PageHeader
        title="Product Backlog"
        description={
          kanban
            ? 'Rank upcoming work. Move items to To Do to pull them onto the board.'
            : 'Plan sprints from a single ranked list of epics, stories, tasks and bugs.'
        }
      >
        {!kanban && (
          <Button variant="outline" onClick={() => setModal({ kind: 'new' })}>
            + Create sprint
          </Button>
        )}
        <Button onClick={() => create({ project_id: pid })}>
          + Create issue
        </Button>
      </PageHeader>
      <div className="tabs">
        <button
          className={view === 'plan' ? 'selected' : ''}
          onClick={() => setView('plan')}
        >
          {kanban ? 'Backlog' : 'Sprints & backlog'}
        </button>
        <button
          className={view === 'epics' ? 'selected' : ''}
          onClick={() => setView('epics')}
        >
          By epic
        </button>
      </div>
      <WorkItemFilters
        state={filters}
        fields={['type', 'priority', 'assignee', 'epic']}
        members={members}
        epics={epics}
      />
      <label className="check-row">
        <input
          type="checkbox"
          checked={showDone}
          onChange={(e) => setShowDone(e.target.checked)}
        />
        Show done items
      </label>
      <BulkActions
        ids={[...selected]}
        members={members}
        sprints={kanban ? [] : all}
        onDone={() => setSelected(new Set())}
      />
      <State
        loading={query.isLoading || sprints.isLoading}
        error={query.error || sprints.error}
      />
      {view === 'plan' ? (
        <>
          {kanban && (
            <section className="card">
              <div className="section-head">
                <h3>On the board</h3>
                <Button asChild variant="outline">
                  <Link to={`/projects/${pid}/board`}>Open board</Link>
                </Button>
              </div>
              <IssueTable issues={inFlow} />
            </section>
          )}
          <PlanningBoard
            projectId={pid}
            issues={issues}
            sprints={kanban ? [] : all}
            zones={kanban ? [] : openSprints}
            filter={visible}
            backlogFilter={(i) =>
              !kanban || ['BACKLOG', 'DONE'].includes(i.status)
            }
            selection={{ ids: selected, toggle }}
            layout="stack"
            sprintHead={(s) => {
              const items = issues.filter((i) => i.sprint_id === s.id);
              const points = items.reduce((n, i) => n + i.story_points, 0);
              return (
                <div className="sprint-head">
                  <p className="muted">
                    {s.goal || 'No goal set'} ·{' '}
                    {s.start_date ?? 'Not scheduled'}
                    {s.end_date ? ` — ${s.end_date}` : ''} · {points} /{' '}
                    {s.capacity} pts
                    {points > s.capacity && (
                      <strong className="error"> · over capacity</strong>
                    )}
                  </p>
                  <div className="actions">
                    <Button
                      variant="ghost"
                      onClick={() => setModal({ kind: 'edit', sprint: s })}
                    >
                      Edit
                    </Button>
                    {s.status === 'PLANNED' ? (
                      <Button
                        variant="outline"
                        onClick={() => setModal({ kind: 'start', sprint: s })}
                      >
                        Start sprint
                      </Button>
                    ) : (
                      <>
                        <Button asChild variant="outline">
                          <Link to={`/projects/${pid}/board`}>Board</Link>
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setModal({ kind: 'complete', sprint: s })
                          }
                        >
                          Complete sprint
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            }}
          />
        </>
      ) : (
        <>
          {[
            ...epics.filter(
              (e) =>
                !filters.filters.epic || String(e.id) === filters.filters.epic,
            ),
            null,
          ].map((epic) => {
            const items = issues.filter(
              (i) =>
                i.issue_type !== 'EPIC' &&
                i.epic_id === (epic?.id ?? null) &&
                visible(i),
            );
            if (!items.length && !epic) return null;
            return (
              <section className="card" key={epic?.id ?? 'none'}>
                <div className="section-head">
                  <h3 className="epic">
                    {epic ? (
                      <Link to={`/issues/${epic.id}`}>
                        EPIC · {epic.summary}
                      </Link>
                    ) : (
                      'Ungrouped issues'
                    )}
                  </h3>
                  <div className="actions">
                    <span className="muted">{items.length} items</span>
                    {epic && (
                      <Button
                        variant="ghost"
                        onClick={() =>
                          create({ project_id: pid, epic_id: epic.id })
                        }
                      >
                        + Add
                      </Button>
                    )}
                  </div>
                </div>
                <IssueTable issues={items} sprints={all} />
              </section>
            );
          })}
        </>
      )}
      {!query.isLoading && issues.length === 0 && <State empty />}
      {modal?.kind === 'complete' && modal.sprint && (
        <CompleteSprintModal
          sprint={modal.sprint}
          sprints={all}
          issues={issues}
          onClose={() => setModal(null)}
        />
      )}
      {modal && modal.kind !== 'complete' && (
        <SprintModal
          projectId={pid}
          sprint={modal.sprint}
          start={modal.kind === 'start'}
          issues={issues.filter(
            (i) => i.sprint_id === (modal.sprint?.id ?? -1),
          )}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
