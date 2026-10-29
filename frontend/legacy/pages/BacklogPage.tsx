import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Checkbox, Tabs, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useCanLead, useData, useIssues } from '../hooks/data';
import type { Project, Sprint } from '../types';
import { PageHeader, State } from '../components/ui/shared';
import { Button, LinkButton } from '../components/ui/button';
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
  const canLead = useCanLead(pid);
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
        {!kanban && canLead && (
          <Button
            variant="outline"
            icon={<PlusOutlined />}
            onClick={() => setModal({ kind: 'new' })}
          >
            Create sprint
          </Button>
        )}
        <Button
          icon={<PlusOutlined />}
          onClick={() => create({ project_id: pid })}
        >
          Create issue
        </Button>
      </PageHeader>
      <Tabs
        activeKey={view}
        onChange={(v) => setView(v as 'plan' | 'epics')}
        items={[
          { key: 'plan', label: kanban ? 'Backlog' : 'Sprints & backlog' },
          { key: 'epics', label: 'By epic' },
        ]}
      />
      <WorkItemFilters
        state={filters}
        fields={['type', 'priority', 'assignee', 'epic']}
        members={members}
        epics={epics}
      />
      <Checkbox
        className="check-row"
        checked={showDone}
        onChange={(e) => setShowDone(e.target.checked)}
      >
        Show done items
      </Checkbox>
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
            <Card
              className="card"
              title="On the board"
              extra={
                <LinkButton
                  variant="outline"
                  size="small"
                  to={`/projects/${pid}/board`}
                >
                  Open board
                </LinkButton>
              }
            >
              <IssueTable issues={inFlow} />
            </Card>
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
                    {canLead && (
                      <Button
                        variant="ghost"
                        onClick={() => setModal({ kind: 'edit', sprint: s })}
                      >
                        Edit
                      </Button>
                    )}
                    {!canLead ? (
                      s.status !== 'PLANNED' && (
                        <LinkButton
                          variant="outline"
                          to={`/projects/${pid}/board`}
                        >
                          Board
                        </LinkButton>
                      )
                    ) : s.status === 'PLANNED' ? (
                      <Button
                        variant="outline"
                        onClick={() => setModal({ kind: 'start', sprint: s })}
                      >
                        Start sprint
                      </Button>
                    ) : (
                      <>
                        <LinkButton
                          variant="outline"
                          to={`/projects/${pid}/board`}
                        >
                          Board
                        </LinkButton>
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
              <Card
                className="card"
                key={epic?.id ?? 'none'}
                title={
                  epic ? (
                    <Link className="epic" to={`/issues/${epic.id}`}>
                      EPIC · {epic.summary}
                    </Link>
                  ) : (
                    'Ungrouped issues'
                  )
                }
                extra={
                  <div className="actions">
                    <Typography.Text type="secondary">
                      {items.length} items
                    </Typography.Text>
                    {epic && (
                      <Button
                        variant="ghost"
                        icon={<PlusOutlined />}
                        onClick={() =>
                          create({ project_id: pid, epic_id: epic.id })
                        }
                      >
                        Add
                      </Button>
                    )}
                  </div>
                }
              >
                <IssueTable issues={items} sprints={all} />
              </Card>
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
