import {
  useState,
  useEffect,
  createContext,
  useContext,
  lazy,
  Suspense,
} from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useProjects, useMe } from '../../hooks/data';
import { Button } from '../ui/button';
import { Badge } from '../ui/shared';
import ProjectNav, { projectPages } from './ProjectNav';
import type { Issue } from '../../types';
const CreateIssueModal = lazy(() => import('../issues/CreateIssueModal'));
const CreateContext = createContext<(initial?: Partial<Issue>) => void>(
  () => {},
);
export const useCreateIssue = () => useContext(CreateContext);
const ProjectContext = createContext<number | undefined>(undefined);
/** The project in the URL, else the last one visited, else the first one. */
export const useCurrentProject = () => useContext(ProjectContext);
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
export default function AppShell() {
  const projects = useProjects();
  const me = useMe();
  const location = useLocation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [create, setCreate] = useState<Partial<Issue> | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState(false);
  const [lastProject, setLastProject] = useState(remembered);
  const [pageProject, setPageProject] = useState<number>();
  const match = location.pathname.match(/projects\/(\d+)/);
  const fromUrl = match
    ? Number(match[1])
    : Number(new URLSearchParams(location.search).get('project')) ||
      pageProject;
  useEffect(() => {
    if (!fromUrl) return;
    setLastProject(fromUrl);
    try {
      localStorage.setItem('trackly_project', String(fromUrl));
    } catch {
      /* storage unavailable */
    }
  }, [fromUrl]);
  const projectId =
    [fromUrl, lastProject].find((id) =>
      projects.data?.some((p) => p.id === id),
    ) ?? projects.data?.[0]?.id;
  const inProject = (page: string) =>
    projectId ? `/projects/${projectId}/${page}` : '/projects';
  const sections: [string, [string, string][]][] = [
    [
      '',
      [
        ['Dashboard', '/dashboard'],
        ['Projects', '/projects'],
        ['Backlog', inProject('backlog')],
        ['Sprints', inProject('sprints')],
        ['Board', inProject('board')],
        ['My Issues', '/my-issues'],
        ...(me.data?.role === 'ADMIN'
          ? [['People', '/people'] as [string, string]]
          : []),
      ],
    ],
    [
      'QUALITY',
      [
        ['QA Dashboard', inProject('quality')],
        [
          'Test Repository',
          projectId ? `/test-cases?project=${projectId}` : '/test-cases',
        ],
        ['Test Runs', inProject('test-runs')],
        ['Bugs', inProject('bugs')],
        ['Traceability', inProject('traceability')],
      ],
    ],
    ['CODE', [['GitHub', '/github']]],
    ['', [['Voice Agent', '/voice-agent']]],
  ];
  const links = sections.flatMap(([, items]) => items);
  const isCurrent = (url: string) => url.split('?')[0] === location.pathname;
  const projectPage = location.pathname.match(/^\/projects\/(\d+)\/?([\w-]*)$/);
  const navProject = projectPage ? Number(projectPage[1]) : pageProject;
  const title = projectPage
    ? (projectPages.find(([, path]) => path === projectPage[2])?.[0] ??
      links.find(([, url]) => isCurrent(url))?.[0] ??
      'Project workspace')
    : location.pathname.includes('/issues/')
      ? 'Issue details'
      : location.pathname.startsWith('/test-cases/')
        ? location.pathname.endsWith('/new')
          ? 'Add Test Case'
          : 'Test case details'
        : (links.find(([, url]) => isCurrent(url))?.[0] ?? 'Project workspace');
  return (
    <PageProjectContext.Provider value={setPageProject}>
      <ProjectContext.Provider value={projectId}>
        <CreateContext.Provider value={(initial) => setCreate(initial ?? {})}>
          <div className={`app ${collapsed ? 'collapsed' : ''}`}>
            <aside className="sidebar">
              <Link
                to="/dashboard"
                aria-label="Zeno Work Suite dashboard"
                className="brand"
              >
                <span className="logo" />
                <span>Zeno Work Suite</span>
              </Link>
              {sections.map(([heading, items], index) => (
                <nav key={index} aria-label={heading || undefined}>
                  {heading && <small className="nav-heading">{heading}</small>}
                  {items.map(([name, url]) => (
                    <NavLink
                      key={name}
                      aria-label={name}
                      title={name}
                      onClick={() => {
                        if (window.innerWidth <= 900) setCollapsed(false);
                      }}
                      to={url}
                      end
                      className={({ isActive }) =>
                        isActive ? 'nav-link active' : 'nav-link'
                      }
                    >
                      <img
                        alt=""
                        src={`/assets/${isCurrent(url) ? 'imgEllipse' : 'imgEllipse1'}.svg`}
                      />
                      <span>{name}</span>
                    </NavLink>
                  ))}
                </nav>
              ))}
              <div className="sidebar-projects">
                <small>RECENT PROJECTS</small>
                {projects.data?.slice(0, 5).map((p) => (
                  <Link
                    className="nav-link"
                    aria-label={p.name}
                    title={p.name}
                    to={`/projects/${p.id}`}
                    key={p.id}
                  >
                    <img alt="" src="/assets/imgEllipse1.svg" />
                    <span>{p.name}</span>
                  </Link>
                ))}
              </div>
              <div className="sidebar-footer">
                <span>One place. Every next step.</span>
              </div>
            </aside>
            <div className="workspace">
              <header className="topbar">
                <div className="actions">
                  <button
                    className="menu-toggle"
                    onClick={() => setCollapsed(!collapsed)}
                    aria-label="Toggle sidebar"
                  >
                    ☰
                  </button>
                  <h2>{title}</h2>
                </div>
                <div className="actions">
                  <form
                    className="search"
                    onSubmit={(e) => {
                      e.preventDefault();
                      nav(`/my-issues?q=${encodeURIComponent(search)}`);
                    }}
                  >
                    <input
                      aria-label="Search issues"
                      placeholder="Search issues…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </form>
                  <Button onClick={() => setCreate({ project_id: projectId })}>
                    + Create
                  </Button>
                  <div className="profile">
                    <button
                      className="avatar-button"
                      onClick={() => setProfile(!profile)}
                      aria-label="Profile menu"
                    >
                      <img alt="" src="/assets/imgEllipse2.svg" />
                    </button>
                    {profile && (
                      <div className="profile-menu">
                        <strong>
                          {me.data?.first_name} {me.data?.last_name}
                        </strong>
                        {me.data?.role && <Badge value={me.data.role} />}
                        <p>{me.data?.email}</p>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            localStorage.removeItem('trackly_token');
                            qc.clear();
                            nav('/login');
                          }}
                        >
                          Sign out
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </header>
              <main>
                {navProject && <ProjectNav projectId={navProject} />}
                <Outlet />
              </main>
            </div>
            {create && (
              <Suspense fallback={null}>
                <CreateIssueModal
                  initial={create}
                  onClose={() => setCreate(null)}
                />
              </Suspense>
            )}
          </div>
        </CreateContext.Provider>
      </ProjectContext.Provider>
    </PageProjectContext.Provider>
  );
}
