import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData, useIssues, useMe, useSave } from '../hooks/data';
import type { Project } from '../types';
import { PageHeader, State, Field } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/dialog';
import IssueTable from '../components/issues/IssueTable';
export default function ProjectPage() {
  const { projectId } = useParams();
  const query = useData<Project>(`/projects/${projectId}`);
  const issues = useIssues(Number(projectId));
  const me = useMe();
  const [tab, setTab] = useState('Overview');
  const [edit, setEdit] = useState(false);
  const nav = useNavigate();
  const save = useSave(`/projects/${projectId}`, 'put');
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
      <PageHeader title={p.name} description={`${p.key} · ${p.description}`}>
        <Button asChild variant="outline">
          <Link to={`/projects/${p.id}/backlog`}>Open backlog</Link>
        </Button>
        {owner && (
          <Button variant="outline" onClick={() => setEdit(true)}>
            Settings
          </Button>
        )}
      </PageHeader>
      <div className="tabs">
        {['Overview', 'Backlog', 'Sprints', 'Board', 'Issues', 'Members'].map(
          (t) =>
            ['Backlog', 'Sprints', 'Board'].includes(t) ? (
              <Link key={t} to={`/projects/${p.id}/${t.toLowerCase()}`}>
                {t}
              </Link>
            ) : (
              <button
                key={t}
                className={tab === t ? 'selected' : ''}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ),
        )}
      </div>
      {tab === 'Members' ? (
        <section className="card">
          <h2>Project members</h2>
          {p.members.map((u) => (
            <div className="list-row" key={u.id}>
              <strong>
                {u.first_name} {u.last_name}
              </strong>
              <span>{u.email}</span>
              {u.id === p.owner_id && <span>Owner</span>}
            </div>
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
                  /*toast*/
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
      ) : (
        <section className="card">
          <h2>{tab === 'Overview' ? 'Project issues' : 'All issues'}</h2>
          <State loading={issues.isLoading} error={issues.error} />
          <IssueTable issues={issues.data ?? []} />
        </section>
      )}
      <Modal
        open={edit}
        onClose={() => setEdit(false)}
        title="Project settings"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await save.mutateAsync(
                Object.fromEntries(new FormData(e.currentTarget)),
              );
              setEdit(false);
            } catch {
              /*toast*/
            }
          }}
        >
          <Field label="Name">
            <input name="name" required defaultValue={p.name} />
          </Field>
          <Field label="Description">
            <textarea name="description" defaultValue={p.description} />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={p.status}>
              <option>ACTIVE</option>
              <option>ARCHIVED</option>
            </select>
          </Field>
          <div className="actions">
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={async () => {
                if (
                  window.confirm(
                    'Delete this project and all its issues, sprints and tests?',
                  )
                ) {
                  try {
                    await del.mutateAsync({});
                    nav('/projects');
                  } catch {
                    /*toast*/
                  }
                }
              }}
            >
              Delete project
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
