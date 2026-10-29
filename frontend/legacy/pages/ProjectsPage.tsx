import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Card, Input, Typography } from 'antd';
import { PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { useMe, useProjects, useSave } from '../hooks/data';
import { canCreateProjects, canManageProject, label } from '../types';
import { PageHeader, State, Field, Badge } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/dialog';
import { Select } from '../components/ui/form';
import ProjectFields from '../components/projects/ProjectFields';
import AssignTeamModal from '../components/projects/AssignTeamModal';
export default function ProjectsPage() {
  const query = useProjects();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState('');
  const save = useSave('/projects', 'post', 'Project created');
  const canCreate = canCreateProjects(me.data?.role);
  const manageable = (query.data ?? []).filter((p) =>
    canManageProject(me.data, p),
  );
  const normalizedSearch = search.trim().toLowerCase();
  const projects = (query.data ?? []).filter((p) => {
    if (!normalizedSearch) return true;
    return [
      p.name,
      p.key,
      p.description,
      p.status,
      p.github_repo,
      p.team
        .map((m) => `${m.user.first_name} ${m.user.last_name} ${m.user.email}`)
        .join(' '),
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedSearch));
  });
  return (
    <>
      <PageHeader
        title="Projects"
        description="A shared home for your team’s next big thing."
      >
        {manageable.length > 0 && (
          <Button
            variant="outline"
            icon={<TeamOutlined />}
            onClick={() => setAssigning(true)}
          >
            Assign team member
          </Button>
        )}
        {canCreate && (
          <Button icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            Create project
          </Button>
        )}
      </PageHeader>
      <State
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.length === 0}
      />
      {(query.data?.length ?? 0) > 0 && (
        <div className="project-toolbar">
          <Input.Search
            allowClear
            aria-label="Search projects"
            placeholder="Search projects by name, key, status or member..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="muted">
            {projects.length} of {query.data?.length ?? 0} projects
          </span>
        </div>
      )}
      {normalizedSearch && projects.length === 0 && (
        <div className="empty">No projects match "{search}".</div>
      )}
      <div className="project-grid">
        {projects.map((p) => {
          const mine = p.team.find((m) => m.user.id === me.data?.id);
          return (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card hoverable className="card project-card">
                <div className="section-head">
                  <Avatar shape="square" size={42} className="project-icon">
                    {p.key.slice(0, 2)}
                  </Avatar>
                  <Badge value={p.status} />
                </div>
                <Typography.Title level={4}>{p.name}</Typography.Title>
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }}>
                  {p.description || 'No description yet.'}
                </Typography.Paragraph>
                {(p.start_date || p.end_date || mine) && (
                  <p className="muted project-meta">
                    {mine && <>Your role: {label(mine.role)}</>}
                    {mine && (p.start_date || p.end_date) && ' · '}
                    {(p.start_date || p.end_date) &&
                      `${p.start_date ?? '…'} → ${p.end_date ?? '…'}`}
                  </p>
                )}
                <div className="project-bottom">
                  <span>{p.key}</span>
                  <span>{p.members.length} members →</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
      {assigning && (
        <AssignTeamModal
          projects={manageable}
          onClose={() => setAssigning(false)}
        />
      )}
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
            <Input name="name" required maxLength={200} />
          </Field>
          <Field label="Key · 2–10 uppercase letters or numbers">
            <Input
              name="key"
              required
              pattern="[A-Z][A-Z0-9]{1,9}"
              maxLength={10}
              placeholder="HRMS"
            />
          </Field>
          <Field label="Description">
            <Input.TextArea name="description" rows={3} />
          </Field>
          <ProjectFields />
          <Field label="Board">
            <Select
              name="board_type"
              defaultValue="SCRUM"
              options={[
                { value: 'SCRUM', label: 'Scrum · plan work in sprints' },
                { value: 'KANBAN', label: 'Kanban · continuous flow' },
              ]}
            />
          </Field>
          <div className="form-footer actions">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              Create project
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
