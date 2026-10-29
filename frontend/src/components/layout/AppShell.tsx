import {
  useState,
  useEffect,
  createContext,
  useContext,
  lazy,
  Suspense,
  type ReactNode,
} from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Input, Layout, Menu, Select, type MenuProps } from 'antd';
import {
  ApartmentOutlined,
  AppstoreOutlined,
  AudioOutlined,
  BugOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FieldTimeOutlined,
  FolderOutlined,
  FundOutlined,
  GithubOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  PlayCircleOutlined,
  ProfileOutlined,
  ProjectOutlined,
  RobotOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useProjects, useMe } from '../../hooks/data';
import ProjectNav from './ProjectNav';
import SidebarProfile from './SidebarProfile';
import type { Issue } from '../../types';
const CreateIssueModal = lazy(() => import('../issues/CreateIssueModal'));
const CreateContext = createContext<(initial?: Partial<Issue>) => void>(
  () => {},
);
export const useCreateIssue = () => useContext(CreateContext);
const ProjectContext = createContext<number | undefined>(undefined);
/**
 * The project in the URL, else the last one visited this session. Undefined
 * until the person picks one, so nothing is preselected right after sign-in.
 */
export const useCurrentProject = () => useContext(ProjectContext);
/** Pages outside /projects/:id that carry their project as ?project=. */
const projectQueryPages = ['/test-cases', '/chat', '/ai-generator', '/github'];
const PageProjectContext = createContext<(id?: number) => void>(() => {});
/**
 * For pages whose URL has no project (issue and test case details): marks the
 * project the page belongs to, so project tabs and sidebar links follow it.
 */
export function usePageProject(id?: number) {
  const set = useContext(PageProjectContext);
  useEffect(() => {
    set(id);
    return () => set(undefined);
  }, [id, set]);
}
const remembered = () => {
  try {
    return Number(localStorage.getItem('trackly_project')) || undefined;
  } catch {
    return undefined;
  }
};
type NavItem = [string, string, ReactNode];
export default function AppShell() {
  const projects = useProjects();
  const me = useMe();
  const location = useLocation();
  const nav = useNavigate();
  const [create, setCreate] = useState<Partial<Issue> | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [lastProject, setLastProject] = useState(remembered);
  const [pageProject, setPageProject] = useState<number>();
  const match = location.pathname.match(/projects\/(\d+)/);
  const fromUrl = match
    ? Number(match[1])
    : Number(new URLSearchParams(location.search).get('project')) ||
      pageProject;
  // A temporary password from an admin must be replaced before using the app.
  useEffect(() => {
    if (me.data?.must_change_password) nav('/change-password', { replace: true });
  }, [me.data?.must_change_password, nav]);
  useEffect(() => {
    if (!fromUrl) return;
    setLastProject(fromUrl);
    try {
      localStorage.setItem('trackly_project', String(fromUrl));
    } catch {
      /* storage unavailable */
    }
  }, [fromUrl]);
  const projectId = [fromUrl, lastProject].find((id) =>
    projects.data?.some((p) => p.id === id),
  );
  const inProject = (page: string) =>
    projectId ? `/projects/${projectId}/${page}` : '/projects';
  const withProject = (page: string) =>
    projectId ? `${page}?project=${projectId}` : page;
  const sections: [string, NavItem[]][] = [
    [
      '',
      [
        ['Dashboard', '/dashboard', <DashboardOutlined />],
        ['Projects', '/projects', <FolderOutlined />],
        ['Backlog', inProject('backlog'), <UnorderedListOutlined />],
        ['Sprints', inProject('sprints'), <FieldTimeOutlined />],
        ['Board', inProject('board'), <ProjectOutlined />],
        ['My Issues', '/my-issues', <ProfileOutlined />],
        ['Chats', withProject('/chat'), <MessageOutlined />],
        ['Automations', '/automations', <ThunderboltOutlined />],
        ...(me.data?.role === 'ADMIN'
          ? [['People', '/admin/users', <TeamOutlined />] as NavItem]
          : []),
      ],
    ],
    [
      'Quality',
      [
        ['QA Dashboard', inProject('quality'), <FundOutlined />],
        ['AI Generator', withProject('/ai-generator'), <RobotOutlined />],
        ['Test Repository', withProject('/test-cases'), <ExperimentOutlined />],
        ['Test Runs', inProject('test-runs'), <PlayCircleOutlined />],
        ['Bugs', inProject('bugs'), <BugOutlined />],
        ['Traceability', inProject('traceability'), <ApartmentOutlined />],
      ],
    ],
    ['Code', [['GitHub', withProject('/github'), <GithubOutlined />]]],
    ['', [['Voice Agent', '/voice-agent', <AudioOutlined />]]],
  ];
  const toItem = ([name, url, icon]: NavItem) => ({
    key: name,
    icon,
    label: <Link to={url}>{name}</Link>,
    title: name,
  });
  const menuItems: MenuProps['items'] = [
    ...sections
      .flatMap(([heading, items], index) => [
        ...(index ? [{ type: 'divider' as const }] : []),
        heading && !collapsed
          ? {
              type: 'group' as const,
              key: heading,
              label: heading.toUpperCase(),
              children: items.map(toItem),
            }
          : items.map(toItem),
      ])
      .flat(),
    { type: 'divider' as const },
    {
      type: 'group' as const,
      key: 'recent',
      label: collapsed ? null : 'RECENT PROJECTS',
      children: (projects.data ?? []).slice(0, 5).map((p) => ({
        key: `recent-${p.id}`,
        icon: <AppstoreOutlined />,
        label: <Link to={`/projects/${p.id}`}>{p.name}</Link>,
        title: p.name,
      })),
    },
  ];
  const selected = sections
    .flatMap(([, items]) => items)
    .filter(([, url]) => url.split('?')[0] === location.pathname)
    .map(([name]) => name);
  const projectPage = location.pathname.match(/^\/projects\/(\d+)\/?([\w-]*)$/);
  const navProject = projectPage ? Number(projectPage[1]) : pageProject;
  /** Shows the same page for another project, else that project's overview. */
  const switchProject = (id: number) => {
    if (projectPage) {
      nav(`/projects/${id}/${projectPage[2]}${location.search}`);
    } else if (projectQueryPages.includes(location.pathname)) {
      const params = new URLSearchParams(location.search);
      params.set('project', String(id));
      nav(`${location.pathname}?${params}`);
    } else {
      nav(`/projects/${id}`);
    }
  };
  return (
    <PageProjectContext.Provider value={setPageProject}>
      <ProjectContext.Provider value={projectId}>
        <CreateContext.Provider value={(initial) => setCreate(initial ?? {})}>
          <Layout hasSider className="app">
            <Layout.Sider
              className="sidebar"
              width={232}
              collapsedWidth={narrow ? 0 : 64}
              collapsed={collapsed}
              breakpoint="lg"
              onBreakpoint={(broken) => {
                setNarrow(broken);
                setCollapsed(broken);
              }}
              trigger={null}
              theme="light"
            >
              <div className="sidebar-inner">
                <Link
                  to="/dashboard"
                  aria-label="Zeno TeamSuite dashboard"
                  className="brand"
                >
                  <span className="logo">Z</span>
                  {!collapsed && <span>Zeno TeamSuite</span>}
                </Link>
                <Menu
                  mode="inline"
                  className="side-menu"
                  inlineCollapsed={collapsed}
                  selectedKeys={selected}
                  items={menuItems}
                  onClick={() => narrow && setCollapsed(true)}
                />
                <SidebarProfile collapsed={collapsed} />
              </div>
            </Layout.Sider>
            <Layout className="workspace">
              <Layout.Header className="topbar">
                <Button
                  type="text"
                  icon={
                    collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
                  }
                  onClick={() => setCollapsed(!collapsed)}
                  aria-label="Toggle sidebar"
                />
                <div className="actions">
                  <Input.Search
                    className="search"
                    aria-label="Search issues"
                    placeholder="Search issues…"
                    allowClear
                    onSearch={(q) =>
                      nav(`/my-issues?q=${encodeURIComponent(q)}`)
                    }
                  />
                  <Select
                    className="project-switcher"
                    aria-label="Project"
                    value={projectId}
                    placeholder={
                      projects.data?.length ? 'Select project' : 'No projects'
                    }
                    disabled={!projects.data?.length}
                    onChange={switchProject}
                    showSearch={{ optionFilterProp: 'label' }}
                    options={projects.data?.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                  />
                </div>
              </Layout.Header>
              <Layout.Content className="content">
                {navProject && <ProjectNav projectId={navProject} />}
                <Outlet />
              </Layout.Content>
            </Layout>
            {narrow && !collapsed && (
              <div className="sider-mask" onClick={() => setCollapsed(true)} />
            )}
            {create && (
              <Suspense fallback={null}>
                <CreateIssueModal
                  initial={create}
                  onClose={() => setCreate(null)}
                />
              </Suspense>
            )}
          </Layout>
        </CreateContext.Provider>
      </ProjectContext.Provider>
    </PageProjectContext.Provider>
  );
}
