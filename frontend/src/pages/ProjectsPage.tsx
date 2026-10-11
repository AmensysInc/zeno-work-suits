import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjects, useSave } from '../hooks/data';
import { PageHeader, State, Field, Badge } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/dialog';
export default function ProjectsPage() {
  const query = useProjects();
  const [open, setOpen] = useState(false);
  const save = useSave('/projects', 'post', 'Project created');
  return (
    <>
      <PageHeader
        title="Projects"
        description="A shared home for your team’s next big thing."
      >
        <Button onClick={() => setOpen(true)}>+ Create project</Button>
      </PageHeader>
      <State
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.length === 0}
      />
      <div className="project-grid">
        {query.data?.map((p) => (
          <Link
            className="card project-card"
            key={p.id}
            to={`/projects/${p.id}`}
          >
            <div className="section-head">
              <span className="project-icon">{p.key.slice(0, 2)}</span>
              <Badge value={p.status} />
            </div>
            <h2>{p.name}</h2>
            <p>{p.description || 'No description yet.'}</p>
            <div className="project-bottom">
              <span>{p.key}</span>
              <span>{p.members.length} members →</span>
            </div>
          </Link>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Create project">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            try {
              await save.mutateAsync(data);
              setOpen(false);
            } catch {
              /*toast*/
            }
          }}
        >
          <Field label="Project name">
            <input name="name" required maxLength={200} />
          </Field>
          <Field label="Key · 2–10 uppercase letters or numbers">
            <input
              name="key"
              required
              pattern="[A-Z][A-Z0-9]{1,9}"
              maxLength={10}
              placeholder="HRMS"
            />
          </Field>
          <Field label="Description">
            <textarea name="description" />
          </Field>
          <div className="form-footer actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Create project
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
