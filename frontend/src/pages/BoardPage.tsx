import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useCanLead, useData, useIssues } from '../hooks/data';
import type { Project, Sprint } from '../types';
import { PageHeader, State } from '../components/ui/shared';
import { Button, LinkButton } from '../components/ui/button';
import KanbanBoard from '../components/board/KanbanBoard';
import WorkItemFilters, {
  useFilters,
} from '../components/issues/WorkItemFilters';
import CompleteSprintModal from '../components/sprints/CompleteSprintModal';
import { useCreateIssue } from '../components/layout/AppShell';

// Kanban boards keep recently finished work visible, then let it drop off.
const DONE_WINDOW_DAYS = 14;

export default function BoardPage() {
  const pid = Number(useParams().projectId);
  const project = useData<Project>(`/projects/${pid}`);
  const sprints = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const query = useIssues(pid);
  const filters = useFilters();
  const create = useCreateIssue();
  const [completing, setCompleting] = useState(false);
  const kanban = project.data?.board_type === 'KANBAN';
  const active = sprints.data?.find((s) => s.status === 'ACTIVE');
  const canLead = useCanLead(pid);
  const cutoff = new Date(
    Date.now() - DONE_WINDOW_DAYS * 86400000,
  ).toISOString();
  const scope =
    query.data?.filter((i) =>
      i.issue_type === 'EPIC'
        ? false
        : kanban
          ? i.status !== 'BACKLOG' &&
            (i.status !== 'DONE' || i.updated_at >= cutoff)
          : i.sprint_id === active?.id,
    ) ?? [];
  const items = scope.filter(filters.matches);
  const points = scope.reduce((n, i) => n + i.story_points, 0);
  const done = scope
    .filter((i) => i.status === 'DONE')
    .reduce((n, i) => n + i.story_points, 0);
  const loading = sprints.isLoading || query.isLoading || project.isLoading;
  const showBoard = kanban || active;
  return (
    <>
      <PageHeader
        title={
          kanban ? 'Kanban board' : (active?.name ?? 'Active sprint board')
        }
        description={
          kanban
            ? `Continuous flow · ${scope.length} items · finished work stays for ${DONE_WINDOW_DAYS} days`
            : active
              ? `${active.goal || 'No goal set'} · ${active.start_date} — ${active.end_date} · ${done} / ${points} points done`
              : 'Start a planned sprint to see your team’s work here.'
        }
      >
        {kanban ? (
          <Button
            icon={<PlusOutlined />}
            onClick={() => create({ project_id: pid })}
          >
            Create issue
          </Button>
        ) : (
          <>
            <LinkButton variant="outline" to={`/projects/${pid}/sprints`}>
              Sprint planning
            </LinkButton>
            {active && canLead && (
              <Button onClick={() => setCompleting(true)}>
                Complete sprint
              </Button>
            )}
          </>
        )}
      </PageHeader>
      <State
        loading={loading}
        error={sprints.error || query.error || project.error}
      />
      {showBoard && !loading && (
        <>
          <WorkItemFilters
            state={filters}
            fields={['type', 'priority', 'assignee']}
            members={project.data?.members}
          />
          <KanbanBoard projectId={pid} issues={items} />
        </>
      )}
      {!showBoard && !loading && (
        <Card className="card">
          <Empty
            description={
              <>
                <strong>No active sprint</strong>
                <br />
                Plan a sprint, add issues, and start when your team is ready.
              </>
            }
          >
            <LinkButton to={`/projects/${pid}/backlog`}>
              Go to backlog
            </LinkButton>
          </Empty>
        </Card>
      )}
      {completing && active && (
        <CompleteSprintModal
          sprint={active}
          sprints={sprints.data ?? []}
          issues={query.data ?? []}
          onClose={() => setCompleting(false)}
        />
      )}
    </>
  );
}
