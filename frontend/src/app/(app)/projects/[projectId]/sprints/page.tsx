'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, Kanban, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useCanLead, useData, useIssues, useSave } from '@/hooks/data';
import type { Sprint } from '@/types';
import { PageBar, PageBody } from '@/components/layout/page';
import { Badge, Card, State } from '@/components/ui/display';
import { Button, LinkButton } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { confirm } from '@/components/ui/confirm';
import PlanningBoard from '@/components/sprints/planning-board';
import { CompleteSprintDialog, SprintDialog } from '@/components/sprints/sprint-dialogs';
import { shortDate } from '@/lib/utils';

export default function SprintPlanningPage() {
  const pid = Number(useParams<{ projectId: string }>().projectId);
  const query = useData<Sprint[]>(`/projects/${pid}/sprints`);
  const issues = useIssues(pid);
  const canLead = useCanLead(pid);
  const [selectedId, setSelectedId] = useState<number>();
  const [modal, setModal] = useState<'create' | 'edit' | 'start' | 'complete' | null>(null);
  const selected = query.data?.find((s) => s.id === selectedId) ?? query.data?.find((s) => s.status === 'ACTIVE') ?? query.data?.[0];
  const remove = useSave(`/sprints/${selected?.id}`, 'delete', 'Sprint deleted');
  const sprintIssues = issues.data?.filter((i) => i.sprint_id === selected?.id) ?? [];
  const points = sprintIssues.reduce((n, i) => n + i.story_points, 0);
  const over = !!selected && points > selected.capacity;
  return (
    <>
      <PageBar
        crumbs={['Sprints']}
        projectId={pid}
        actions={
          canLead && (
            <Button variant="primary" icon={<Plus />} onClick={() => setModal('create')}>
              Create sprint
            </Button>
          )
        }
      />
      <PageBody>
        {!canLead && <p className="mb-3 text-[12.5px] text-ink-3">Project leads and managers create, start and complete sprints.</p>}
        <State loading={query.isLoading || issues.isLoading} error={query.error || issues.error} empty={query.data?.length === 0} emptyText="Create a sprint to start planning." />
        {selected && (
          <div className="flex flex-col gap-3.5">
            <Card className="flex flex-col gap-4 px-[18px] py-4 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Select<number>
                    aria-label="Select sprint"
                    className="h-8 border-transparent px-1 text-[17px] font-semibold shadow-none hover:border-line-2"
                    value={selected.id}
                    onChange={setSelectedId}
                    options={(query.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  />
                  <Badge value={selected.status} />
                </div>
                <span className="px-1 text-[12.5px] text-ink-2">{selected.goal ? `Goal: ${selected.goal}` : 'No goal set'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11.5px] text-ink-3">Dates</span>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium">
                  <Calendar className="size-3.5 text-ink-3" />
                  {selected.start_date ? `${shortDate(selected.start_date)} — ${shortDate(selected.end_date) || 'Not set'}` : 'No dates'}
                </span>
              </div>
              <div className="flex w-full flex-col gap-1 lg:w-[200px]">
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-ink-3">Capacity</span>
                  <b className={`tnum font-semibold ${over ? 'text-red-600' : ''}`}>
                    {points} / {selected.capacity} pts
                  </b>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-hover">
                  <i className="block h-full" style={{ width: `${Math.min(100, (points / Math.max(1, selected.capacity)) * 100)}%`, background: over ? '#e5484d' : 'var(--accent)' }} />
                </div>
                {over && <span className="text-[11.5px] text-red-600">{points - selected.capacity} pts over capacity</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canLead && selected.status === 'PLANNED' && (
                  <Button
                    variant="ghost"
                    icon={<Trash2 />}
                    loading={remove.isPending}
                    onClick={async () => {
                      if (await confirm(`Delete ${selected.name}? Its issues return to the backlog.`, { okText: 'Delete' })) {
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
                )}
                {canLead && selected.status !== 'COMPLETED' && (
                  <Button icon={<Pencil />} onClick={() => setModal('edit')}>
                    Edit
                  </Button>
                )}
                {canLead && selected.status === 'PLANNED' && (
                  <Button variant="primary" icon={<Play />} onClick={() => setModal('start')}>
                    Start sprint
                  </Button>
                )}
                {selected.status === 'ACTIVE' && (
                  <>
                    <LinkButton href={`/projects/${pid}/board`} icon={<Kanban className="size-3.5" />}>
                      View board
                    </LinkButton>
                    {canLead && (
                      <Button variant="primary" onClick={() => setModal('complete')}>
                        Complete sprint
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>
            <PlanningBoard layout="columns" projectId={pid} issues={issues.data ?? []} sprints={query.data ?? []} zones={[selected]} />
          </div>
        )}
      </PageBody>
      {modal === 'complete' && selected && <CompleteSprintDialog sprint={selected} sprints={query.data ?? []} issues={issues.data ?? []} onClose={() => setModal(null)} />}
      {modal && modal !== 'complete' && (
        <SprintDialog projectId={pid} sprint={modal === 'create' ? undefined : selected} start={modal === 'start'} issues={sprintIssues} onClose={() => setModal(null)} />
      )}
    </>
  );
}
