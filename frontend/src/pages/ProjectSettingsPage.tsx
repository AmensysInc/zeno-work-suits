import { useNavigate, useParams } from 'react-router-dom';
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
      <span className="mini-avatar">
        {user.first_name[0]}
        {user.last_name[0]}
      </span>
      <strong>
        {user.first_name} {user.last_name}
      </strong>
      <span className="muted">{user.email}</span>
      <Badge value={user.role} />
      {user.id === project.owner_id && <span className="badge">Owner</span>}
      {canRemove ? (
        <select
          aria-label={`Project role for ${user.first_name} ${user.last_name}`}
          value={role}
          disabled={changeRole.isPending}
          onChange={(e) =>
            changeRole.mutate({ user_ids: [user.id], role: e.target.value })
          }
        >
          {projectRoles.map((r) => (
            <option key={r} value={r}>
              {label(r)}
            </option>
          ))}
        </select>
      ) : (
        <span className="badge">{label(role)}</span>
      )}
      {canRemove && user.id !== project.owner_id && (
        <Button
          variant="ghost"
          disabled={remove.isPending}
          onClick={() => {
            if (
              window.confirm(
                `Remove ${user.first_name} from ${project.name}? Their open work becomes unassigned.`,
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
        <section className="card">
          <h2>General</h2>
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
            <fieldset disabled={!canManage}>
              <Field label="Key">
                <input value={p.key} disabled readOnly />
              </Field>
              <Field label="Name">
                <input
                  name="name"
                  required
                  maxLength={200}
                  defaultValue={p.name}
                />
              </Field>
              <Field label="Description">
                <textarea name="description" defaultValue={p.description} />
              </Field>
              <ProjectFields project={p} />
              <div className="form-grid">
                <Field label="Board">
                  <select name="board_type" defaultValue={p.board_type}>
                    <option value="SCRUM">Scrum · sprints</option>
                    <option value="KANBAN">Kanban · continuous flow</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select name="status" defaultValue={p.status}>
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </Field>
              </div>
              {canManage && (
                <div className="actions form-footer">
                  <Button type="submit" disabled={save.isPending}>
                    Save changes
                  </Button>
                </div>
              )}
            </fieldset>
          </form>
        </section>
        <section className="card">
          <h2>Members · {p.team.length}</h2>
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
              <input
                name="email"
                type="email"
                required
                aria-label="Registered member email"
                placeholder="Add a registered teammate by email"
              />
              <select
                name="role"
                aria-label="Project role"
                defaultValue="DEVELOPER"
              >
                {projectRoles.map((r) => (
                  <option key={r} value={r}>
                    {label(r)}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={member.isPending}>
                Add member
              </Button>
            </form>
          )}
        </section>
      </div>
      {canManage && (
        <section className="card danger-zone">
          <div className="section-head">
            <div>
              <h2>Delete project</h2>
              <p className="muted">
                Permanently removes every issue, sprint, test case and run.
              </p>
            </div>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={async () => {
                if (
                  window.confirm(
                    `Delete ${p.name} and all its issues, sprints and tests? This cannot be undone.`,
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
        </section>
      )}
    </>
  );
}
