import { useNavigate, useParams } from 'react-router-dom';
import { Avatar, Card, ConfigProvider, Input, Tag, Typography } from 'antd';
import { useData, useMe, useSave } from '../hooks/data';
import {
  canManageProject,
  label,
  projectRoles,
  type Project,
  type ProjectRole,
  type TeamMember,
} from '../types';
import { Badge, Field, PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { Select, labelled } from '../components/ui/form';
import { confirm } from '../components/ui/confirm';
import ProjectFields from '../components/projects/ProjectFields';

function MemberRow({
  project,
  member: { user, role },
  canRemove,
}: {
  project: Project;
  member: TeamMember;
  canRemove: boolean;
}) {
  const remove = useSave(
    `/projects/${project.id}/members/${user.id}`,
    'delete',
    'Member removed',
  );
  const changeRole = useSave(
    `/projects/${project.id}/members`,
    'post',
    'Project role updated',
  );
  return (
    <div className="list-row">
      <Avatar size={32} className="mini-avatar">
        {user.first_name[0]}
        {user.last_name[0]}
      </Avatar>
      <div className="member-name">
        <Typography.Text strong>
          {user.first_name} {user.last_name}
        </Typography.Text>
        <Typography.Text type="secondary">{user.email}</Typography.Text>
      </div>
      <Badge value={user.role} />
      {user.id === project.owner_id && <Tag color="gold">Owner</Tag>}
      {canRemove ? (
        <Select
          className="role-select"
          aria-label={`Project role for ${user.first_name} ${user.last_name}`}
          value={role}
          disabled={changeRole.isPending}
          onChange={(v) => changeRole.mutate({ user_ids: [user.id], role: v })}
          options={labelled(projectRoles)}
        />
      ) : (
        <Tag>{label(role)}</Tag>
      )}
      {canRemove && user.id !== project.owner_id && (
        <Button
          variant="ghost"
          disabled={remove.isPending}
          onClick={async () => {
            if (
              await confirm(
                `Remove ${user.first_name} from ${project.name}? Their open work becomes unassigned.`,
                { okText: 'Remove' },
              )
            )
              remove.mutate({});
          }}
        >
          Remove
        </Button>
      )}
    </div>
  );
}

export default function ProjectSettingsPage() {
  const { projectId } = useParams();
  const query = useData<Project>(`/projects/${projectId}`);
  const me = useMe();
  const nav = useNavigate();
  const save = useSave(`/projects/${projectId}`, 'put', 'Settings saved');
  const member = useSave(
    `/projects/${projectId}/members`,
    'post',
    'Member added',
  );
  const del = useSave(`/projects/${projectId}`, 'delete', 'Project deleted');
  const p = query.data;
  if (!p) return <State loading={query.isLoading} error={query.error} />;
  const canManage = canManageProject(me.data, p);
  return (
    <>
      <PageHeader
        title="Project settings"
        description={
          canManage
            ? 'Details, workflow and who can work in this project.'
            : 'Only an admin, or a manager who owns this project, can change these settings.'
        }
      />
      <div className="settings-grid">
        <Card className="card" title="General">
          <form
            key={p.updated_at}
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await save.mutateAsync(
                  Object.fromEntries(new FormData(e.currentTarget)),
                );
              } catch {
                /* toast */
              }
            }}
          >
            <ConfigProvider componentDisabled={!canManage}>
              <Field label="Key">
                <Input value={p.key} disabled readOnly />
              </Field>
              <Field label="Name">
                <Input
                  name="name"
                  required
                  maxLength={200}
                  defaultValue={p.name}
                />
              </Field>
              <Field label="Description">
                <Input.TextArea
                  name="description"
                  rows={3}
                  defaultValue={p.description}
                />
              </Field>
              <ProjectFields project={p} />
              <div className="form-grid">
                <Field label="Board">
                  <Select
                    name="board_type"
                    defaultValue={p.board_type}
                    options={[
                      { value: 'SCRUM', label: 'Scrum · sprints' },
                      { value: 'KANBAN', label: 'Kanban · continuous flow' },
                    ]}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    name="status"
                    defaultValue={p.status}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'ARCHIVED', label: 'Archived' },
                    ]}
                  />
                </Field>
              </div>
              {canManage && (
                <div className="actions form-footer">
                  <Button type="submit" loading={save.isPending}>
                    Save changes
                  </Button>
                </div>
              )}
            </ConfigProvider>
          </form>
        </Card>
        <Card className="card" title={`Members · ${p.team.length}`}>
          {p.team.map((m) => (
            <MemberRow
              key={m.user.id}
              project={p}
              member={m}
              canRemove={canManage}
            />
          ))}
          {canManage && (
            <form
              className="inline-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = new FormData(form);
                try {
                  await member.mutateAsync({
                    email: data.get('email'),
                    role: data.get('role') as ProjectRole,
                  });
                  form.reset();
                } catch {
                  /* toast */
                }
              }}
            >
              <Input
                name="email"
                type="email"
                required
                aria-label="Registered member email"
                placeholder="Add a registered teammate by email"
              />
              <Select
                name="role"
                className="role-select"
                aria-label="Project role"
                defaultValue="DEVELOPER"
                options={labelled(projectRoles)}
              />
              <Button type="submit" loading={member.isPending}>
                Add member
              </Button>
            </form>
          )}
        </Card>
      </div>
      {canManage && (
        <Card className="card danger-zone">
          <div className="section-head">
            <div>
              <Typography.Title level={5}>Delete project</Typography.Title>
              <p className="muted">
                Permanently removes every issue, sprint, test case and run.
              </p>
            </div>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={async () => {
                if (
                  await confirm(
                    `Delete ${p.name} and all its issues, sprints and tests? This cannot be undone.`,
                    { okText: 'Delete project' },
                  )
                ) {
                  try {
                    await del.mutateAsync({});
                    nav('/projects');
                  } catch {
                    /* toast */
                  }
                }
              }}
            >
              Delete project
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
