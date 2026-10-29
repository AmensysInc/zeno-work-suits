'use client';

import { useState } from 'react';
import { useData, useSave } from '@/hooks/data';
import { label, projectRoles, type Project, type ProjectRole, type User } from '@/types';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/controls';
import { Avatar, ProjectMark } from '@/components/ui/display';

export default function AssignTeamDialog({ projects, onClose }: { projects: Project[]; onClose: () => void }) {
  const people = useData<User[]>('/auth/users');
  const [projectId, setProjectId] = useState(projects[0]?.id);
  const [chosen, setChosen] = useState<number[]>([]);
  const [role, setRole] = useState<ProjectRole>('DEVELOPER');
  const project = projects.find((p) => p.id === projectId);
  const save = useSave(`/projects/${projectId}/members`, 'post', 'Team members assigned');
  const current = new Map(project?.team.map((m) => [m.user.id, m.role]));
  const toggle = (id: number) => setChosen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const submit = async () => {
    try {
      await save.mutateAsync({ user_ids: chosen, role });
      onClose();
    } catch {
      /* toast */
    }
  };
  return (
    <Dialog
      title="Assign team members"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!projectId || !chosen.length} loading={save.isPending} onClick={submit}>
            Assign {chosen.length || ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project">
            {(id) => (
              <Select<number>
                id={id}
                value={projectId}
                onChange={(v) => {
                  setProjectId(v);
                  setChosen([]);
                }}
                options={projects.map((p) => ({ value: p.id, label: `${p.name} · ${p.key}`, icon: <ProjectMark project={p} size={16} /> }))}
              />
            )}
          </Field>
          <Field label="Role on this project">
            {(id) => <Select<ProjectRole> id={id} value={role} onChange={setRole} options={projectRoles.map((r) => ({ value: r, label: label(r) }))} />}
          </Field>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[12.5px] font-medium">Team members · {chosen.length} selected</legend>
          {people.isLoading && <p className="text-[13px] text-ink-3">Loading people…</p>}
          {people.error && <p className="text-[13px] text-red-600">Unable to load people. Please try again.</p>}
          <div className="scrollbar-thin max-h-72 overflow-y-auto rounded-lg border border-line">
            {people.data
              ?.filter((u) => u.id !== project?.owner_id)
              .map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2.5 border-b border-line px-3 py-2 last:border-0 hover:bg-subtle">
                  <Checkbox checked={chosen.includes(u.id)} onChange={() => toggle(u.id)} aria-label={`${u.first_name} ${u.last_name}`} />
                  <Avatar user={u} size={24} />
                  <span className="flex-1 text-[13px] font-medium">
                    {u.first_name} {u.last_name}
                  </span>
                  <span className="text-xs text-ink-3">{current.has(u.id) ? `Already ${label(current.get(u.id)!)}` : u.email}</span>
                </label>
              ))}
          </div>
          {people.data?.length === 1 && <p className="text-xs text-ink-3">No one else has been added yet. Ask an admin to add teammates first.</p>}
        </fieldset>
      </div>
    </Dialog>
  );
}
