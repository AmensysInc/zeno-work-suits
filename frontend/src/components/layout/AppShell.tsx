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
  const [create, setCreate] = useState<Partial<Issue> | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
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
  const isCurrent = (url: string) => url.split('?')[0] === location.pathname;
  const projectPage = location.pathname.match(/^\/projects\/(\d+)\/?([\w-]*)$/);
  const navProject = projectPage ? Number(projectPage[1]) : pageProject;
  /** Shows the same page for another project, else that project's overview. */
  const switchProject = (id: number) => {
    if (projectPage) {
      nav(`/projects/${id}/${projectPage[2]}${location.search}`);
    } else if (location.pathname === '/test-cases') {
      const params = new URLSearchParams(location.search);
      params.set('project', String(id));
      nav(`/test-cases?${params}`);
    } else {
      nav(`/projects/${id}`);
    }
  };
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
              <SidebarProfile />
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
                  <select
                    className="project-switcher"
                    aria-label="Project"
                    value={projectId ?? ''}
                    disabled={!projects.data?.length}
                    onChange={(e) => switchProject(Number(e.target.value))}
                  >
                    {!projects.data?.length && (
                      <option value="">No projects</option>
                    )}
                    {projects.data?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
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
