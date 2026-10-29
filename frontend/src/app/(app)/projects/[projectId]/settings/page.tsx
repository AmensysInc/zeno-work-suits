'use client';

import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2, UserPlus } from 'lucide-react';
import { useData, useMe, useSave } from '@/hooks/data';
import { canManageProject, label, projectRoles, type Project, type ProjectRole, type TeamMember } from '@/types';
import { PageBar, PageBody } from '@/components/layout/page';
import { Avatar, Badge, Card, CardHeader, Note, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { confirm } from '@/components/ui/confirm';
import ProjectFields from '@/components/projects/project-fields';

const roleOptions = projectRoles.map((r) => ({ value: r, label: label(r) }));

function MemberRow({ project, member: { user, role }, canManage }: { project: Project; member: TeamMember; canManage: boolean }) {
  const remove = useSave(`/projects/${project.id}/members/${user.id}`, 'delete', 'Member removed');
  const changeRole = useSave(`/projects/${project.id}/members`, 'post', 'Project role updated');
  const owner = user.id === project.owner_id;
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
      <Avatar user={user} size={30} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium">
          {user.first_name} {user.last_name}
        </span>
        <span className="truncate text-xs text-ink-3">{user.email}</span>
      </div>
      <Badge value={user.role} />
      {owner && <Badge tone="amber">Owner</Badge>}
      {canManage ? (
        <Select<ProjectRole>
          size="sm"
          className="w-36"
          aria-label={`Project role for ${user.first_name} ${user.last_name}`}
          value={role}
          disabled={changeRole.isPending}
          onChange={(v) => changeRole.mutate({ user_ids: [user.id], role: v })}
          options={roleOptions}
        />
      ) : (
        <Badge>{label(role)}</Badge>
      )}
      {canManage && !owner ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Remove ${user.first_name}`}
          title="Remove"
          icon={<Trash2 />}
          disabled={remove.isPending}
          onClick={async () => {
            if (await confirm(`Remove ${user.first_name} from ${project.name}? Their open work becomes unassigned.`, { okText: 'Remove' })) remove.mutate({});
          }}
        />
      ) : (
        canManage && <span className="w-8" />
      )}
    </div>
  );
}

function GeneralForm({ p, canManage }: { p: Project; canManage: boolean }) {
  const save = useSave(`/projects/${p.id}`, 'put', 'Settings saved');
  const [board, setBoard] = useState(p.board_type);
  const [status, setStatus] = useState(p.status);
  return (
    <form
      className="flex flex-col gap-3.5 px-4 pb-4 pt-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await save.mutateAsync({ ...Object.fromEntries(new FormData(e.currentTarget)), board_type: board, status });
        } catch {
          /* toast */
        }
      }}
    >
      <fieldset disabled={!canManage} className="contents">
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label="Key">{(id) => <Input id={id} value={p.key} disabled readOnly />}</Field>
          <Field label="Name">{(id) => <Input id={id} name="name" required maxLength={200} defaultValue={p.name} />}</Field>
        </div>
        <Field label="Description">{(id) => <Textarea id={id} name="description" rows={3} defaultValue={p.description} />}</Field>
        <ProjectFields project={p} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Board">
            {(id) => (
              <Select<Project['board_type']>
                id={id}
                disabled={!canManage}
                value={board}
                onChange={setBoard}
                options={[
                  { value: 'SCRUM', label: 'Scrum · sprints' },
                  { value: 'KANBAN', label: 'Kanban · continuous flow' },
                ]}
              />
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select<Project['status']>
                id={id}
                disabled={!canManage}
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'ARCHIVED', label: 'Archived' },
                ]}
              />
            )}
          </Field>
        </div>
      </fieldset>
      {canManage && (
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save changes
          </Button>
        </div>
      )}
    </form>
  );
}

export default function ProjectSettingsPage() {
  const projectId = Number(useParams<{ projectId: string }>().projectId);
  const query = useData<Project>(`/projects/${projectId}`);
  const me = useMe();
  const router = useRouter();
  const member = useSave(`/projects/${projectId}/members`, 'post', 'Member added');
  const del = useSave(`/projects/${projectId}`, 'delete', 'Project deleted');
  const [role, setRole] = useState<ProjectRole>('DEVELOPER');
  const addForm = useRef<HTMLFormElement>(null);
  const p = query.data;
  const canManage = !!p && canManageProject(me.data, p);
  return (
    <>
      <PageBar crumbs={['Settings']} projectId={projectId} />
      <PageBody>
        {!p ? (
          <State loading={query.isLoading} error={query.error} />
        ) : (
          <div className="mx-auto flex max-w-[1080px] flex-col gap-4">
            {!canManage && <Note>Only an admin, or a manager who owns this project, can change these settings.</Note>}
            <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_1fr]">
              <Card>
                <CardHeader title="General" subtitle="Details, schedule and workflow" />
                <GeneralForm key={p.updated_at} p={p} canManage={canManage} />
              </Card>
              <Card className="overflow-hidden">
                <CardHeader title={`Members · ${p.team.length}`} subtitle="Who can work in this project" className="pb-3" />
                <div className="border-t border-line">
                  {p.team.map((m) => (
                    <MemberRow key={m.user.id} project={p} member={m} canManage={canManage} />
                  ))}
                </div>
                {canManage && (
                  <form
                    ref={addForm}
                    className="flex flex-wrap items-center gap-2 border-t border-line bg-subtle px-4 py-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      try {
                        await member.mutateAsync({ email: new FormData(form).get('email'), role });
                        form.reset();
                      } catch {
                        /* toast */
                      }
                    }}
                  >
                    <Input name="email" type="email" required aria-label="Registered member email" placeholder="Add a registered teammate by email" className="min-w-[200px] flex-1" />
                    <Select<ProjectRole> aria-label="Project role" className="w-36" value={role} onChange={setRole} options={roleOptions} />
                    <Button type="submit" variant="primary" icon={<UserPlus />} loading={member.isPending}>
                      Add
                    </Button>
                  </form>
                )}
              </Card>
            </div>
            {canManage && (
              <Card className="flex flex-col gap-3 border-red-200 px-4 py-4 sm:flex-row sm:items-center dark:border-red-900/50">
                <div className="flex-1">
                  <div className="text-[14px] font-semibold text-red-600">Delete project</div>
                  <p className="text-[12.5px] text-ink-2">Permanently removes every issue, sprint, test case and run.</p>
                </div>
                <Button
                  variant="danger"
                  icon={<Trash2 />}
                  loading={del.isPending}
                  onClick={async () => {
                    if (await confirm(`Delete ${p.name} and all its issues, sprints and tests? This cannot be undone.`, { okText: 'Delete project' })) {
                      try {
                        await del.mutateAsync({});
                        router.push('/projects');
                      } catch {
                        /* toast */
                      }
                    }
                  }}
                >
                  Delete project
                </Button>
              </Card>
            )}
          </div>
        )}
      </PageBody>
    </>
  );
}
