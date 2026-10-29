import { useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Space, Tabs, Tag, Typography } from 'antd';
import { useData } from '../../hooks/data';
import type { Project } from '../../types';

export const projectPages: [string, string][] = [
  ['Overview', ''],
  ['All Work Items', 'work-items'],
  ['Epics', 'epics'],
  ['Reports', 'reports'],
  ['Settings', 'settings'],
];

/** Tabs shared by every page inside a project. */
export default function ProjectNav({ projectId }: { projectId: number }) {
  const project = useData<Project>(`/projects/${projectId}`);
  const location = useLocation();
  const nav = useNavigate();
  const base = `/projects/${projectId}`;
  const urls = projectPages.map(([, path]) =>
    path ? `${base}/${path}` : base,
  );
  return (
    <div className="project-nav">
      {project.data && (
        <Space className="project-crumb" size={10}>
          <Avatar shape="square" size={28} className="project-icon">
            {project.data.key.slice(0, 2)}
          </Avatar>
          <Typography.Text strong>{project.data.name}</Typography.Text>
          <Tag variant="filled">{project.data.key}</Tag>
          <Typography.Text type="secondary">
            {project.data.board_type === 'KANBAN' ? 'Kanban' : 'Scrum'}
          </Typography.Text>
        </Space>
      )}
      <Tabs
        aria-label="Project"
        activeKey={urls.includes(location.pathname) ? location.pathname : ''}
        onChange={(url) => nav(url)}
        items={projectPages.map(([name], i) => ({ key: urls[i], label: name }))}
      />
    </div>
  );
}
