import { useNavigate, useParams } from 'react-router-dom';
import { useData, useMe, useSave } from '../hooks/data';
import type { Project, User } from '../types';
import { Field, PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';

function MemberRow({
  project,
  user,
  canRemove,
}: {
  project: Project;
  user: User;
  canRemove: boolean;
}) {
  const remove = useSave(
    `/projects/${project.id}/members/${user.id}`,
    'delete',
    'Member removed',
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
      {user.id === project.owner_id && <span className="badge">Owner</span>}
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
  const owner = p.owner_id === me.data?.id;
  return (
    <>
      <PageHeader
        title="Project settings"
        description={
          owner
            ? 'Details, workflow and who can work in this project.'
            : 'Only the project owner can change these settings.'
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
            <fieldset disabled={!owner}>
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
              {owner && (
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
          <h2>Members · {p.members.length}</h2>
          {p.members.map((u) => (
            <MemberRow key={u.id} project={p} user={u} canRemove={owner} />
          ))}
          {owner && (
            <form
              className="inline-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                try {
                  await member.mutateAsync({
                    email: new FormData(form).get('email'),
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
              <Button type="submit" disabled={member.isPending}>
                Add member
              </Button>
            </form>
          )}
        </section>
      </div>
      {owner && (
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
