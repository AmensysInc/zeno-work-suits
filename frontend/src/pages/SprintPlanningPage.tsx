import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useCanLead, useData, useIssues, useSave } from '../hooks/data';
import type { Sprint } from '../types';
import { PageHeader, State, Badge } from '../components/ui/shared';
import { Button, LinkButton } from '../components/ui/button';
import { Select } from '../components/ui/form';
import { confirm } from '../components/ui/confirm';
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
  const canLead = useCanLead(pid);
  return (
    <>
      <PageHeader
        title="Sprint planning"
        description={
          canLead
            ? 'Give your team a clear goal and a focused set of work.'
            : 'Project leads and managers create, start and complete sprints.'
        }
      >
        {canLead && (
          <Button icon={<PlusOutlined />} onClick={() => setModal('create')}>
            Create sprint
          </Button>
        )}
      </PageHeader>
      <State
        loading={query.isLoading || issues.isLoading}
        error={query.error || issues.error}
        empty={query.data?.length === 0}
      />
      {selected && (
        <>
          <Card className="card">
            <div className="sprint-summary">
              <div>
                <Select
                  aria-label="Select sprint"
                  className="sprint-select"
                  variant="borderless"
                  value={selected.id}
                  onChange={(v) => setSelectedId(Number(v))}
                  options={(query.data ?? []).map((s) => ({
                    value: s.id,
                    label: s.name,
                  }))}
                />
                <Typography.Paragraph>{selected.goal}</Typography.Paragraph>
                <p>
                  {selected.start_date ?? 'No dates'} —{' '}
                  {selected.end_date ?? 'Not set'} ·{' '}
                  {sprintIssues.reduce((n, i) => n + i.story_points, 0)} /{' '}
                  {selected.capacity} story points
                </p>
              </div>
              <div className="actions">
                <Badge value={selected.status} />
                {canLead && selected.status !== 'COMPLETED' && (
                  <Button variant="outline" onClick={() => setModal('edit')}>
                    Edit
                  </Button>
                )}
                {canLead && selected.status === 'PLANNED' && (
                  <>
                    <Button
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={async () => {
                        if (
                          await confirm(
                            `Delete ${selected.name}? Its issues return to the backlog.`,
                            { okText: 'Delete' },
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
                    <LinkButton variant="outline" to={`/projects/${pid}/board`}>
                      View board
                    </LinkButton>
                    {canLead && (
                      <Button onClick={() => setModal('complete')}>
                        Complete sprint
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>
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
