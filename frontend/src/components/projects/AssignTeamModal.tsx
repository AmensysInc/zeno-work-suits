import { useState } from 'react';
import { useData, useSave } from '../../hooks/data';
import { Modal } from '../ui/dialog';
import { Field } from '../ui/shared';
import { Button } from '../ui/button';
import {
  label,
  projectRoles,
  type Project,
  type ProjectRole,
  type User,
} from '../../types';

export default function AssignTeamModal({
  projects,
  onClose,
}: {
  projects: Project[];
  onClose: () => void;
}) {
  const people = useData<User[]>('/auth/users');
  const [projectId, setProjectId] = useState(projects[0]?.id);
  const [chosen, setChosen] = useState<number[]>([]);
  const [role, setRole] = useState<ProjectRole>('DEVELOPER');
  const project = projects.find((p) => p.id === projectId);
  const save = useSave(
    `/projects/${projectId}/members`,
    'post',
    'Team members assigned',
  );
  const current = new Map(project?.team.map((m) => [m.user.id, m.role]));
  const toggle = (id: number) =>
    setChosen((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  return (
    <Modal open title="Assign team members" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await save.mutateAsync({ user_ids: chosen, role });
            onClose();
          } catch {
            /* toast */
          }
        }}
      >
        <Field label="Project">
          <select
            required
            value={projectId ?? ''}
            onChange={(e) => {
              setProjectId(Number(e.target.value));
              setChosen([]);
            }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.key}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role on this project">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ProjectRole)}
          >
            {projectRoles.map((r) => (
              <option key={r} value={r}>
                {label(r)}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="field">
          <span>Team members · {chosen.length} selected</span>
          {people.isLoading && <p className="muted">Loading people…</p>}
          {people.error && (
            <p className="error">Unable to load people. Please try again.</p>
          )}
          <div className="pick-list">
            {people.data
              ?.filter((u) => u.id !== project?.owner_id)
              .map((u) => (
                <label className="check-row" key={u.id}>
                  <input
                    type="checkbox"
                    checked={chosen.includes(u.id)}
                    onChange={() => toggle(u.id)}
                  />
                  <span className="mini-avatar">
                    {u.first_name[0]}
                    {u.last_name[0]}
                  </span>
                  <span>
                    {u.first_name} {u.last_name}
                  </span>
                  <span className="muted">
                    {current.has(u.id)
                      ? `Already ${label(current.get(u.id)!)}`
                      : u.email}
                  </span>
                </label>
              ))}
          </div>
          {people.data?.length === 1 && (
            <p className="muted">
              No one else has registered yet. Ask teammates to create an account
              first.
            </p>
          )}
        </fieldset>
        <div className="actions form-footer">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!projectId || !chosen.length || save.isPending}
          >
            Assign {chosen.length || ''}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
