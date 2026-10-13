import { NavLink } from 'react-router-dom';
import { useData } from '../../hooks/data';
import type { Project } from '../../types';

export const projectPages: [string, string][] = [
  ['Overview', ''],
  ['Product Backlog', 'backlog'],
  ['All Work Items', 'work-items'],
  ['Epics', 'epics'],
  ['Sprints', 'sprints'],
  ['Board', 'board'],
  ['Bugs', 'bugs'],
  ['Test Cases', 'test-cases'],
  ['Reports', 'reports'],
  ['Settings', 'settings'],
];

/** Tabs shared by every page inside a project. */
export default function ProjectNav({ projectId }: { projectId: number }) {
  const project = useData<Project>(`/projects/${projectId}`);
  return (
    <div className="project-nav">
      {project.data && (
        <p className="project-crumb">
          <span className="project-icon">{project.data.key.slice(0, 2)}</span>
          <strong>{project.data.name}</strong>
          <span className="muted">
            {project.data.key} ·{' '}
            {project.data.board_type === 'KANBAN' ? 'Kanban' : 'Scrum'}
          </span>
        </p>
      )}
      <nav className="tabs" aria-label="Project">
        {projectPages.map(([name, path]) => (
          <NavLink
            key={name}
            end
            to={`/projects/${projectId}${path ? `/${path}` : ''}`}
            className={({ isActive }) => (isActive ? 'selected' : '')}
          >
            {name}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
