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
const CreateIssueModal = lazy(() => import('../issues/CreateIssueModal'));
import type { Issue } from '../../types';
const CreateContext = createContext<(initial?: Partial<Issue>) => void>(
  () => {},
);
export const useCreateIssue = () => useContext(CreateContext);
const ProjectContext = createContext<number | undefined>(undefined);
/** The project in the URL, else the last one visited, else the first one. */
export const useCurrentProject = () => useContext(ProjectContext);
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
  const match = location.pathname.match(/projects\/(\d+)/);
  const fromUrl = match
    ? Number(match[1])
    : Number(new URLSearchParams(location.search).get('project')) || undefined;
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
    ['', [['Voice Agent', '/voice-agent']]],
    ...(me.data?.is_admin
      ? ([['ADMIN', [['Users', '/admin/users']]]] as [string, [string, string][]][])
      : []),
  ];
  const links = sections.flatMap(([, items]) => items);
  const isCurrent = (url: string) => url.split('?')[0] === location.pathname;
  const title = location.pathname.includes('/issues/')
    ? 'Issue details'
    : location.pathname.startsWith('/test-cases/')
      ? location.pathname.endsWith('/new')
        ? 'Add Test Case'
        : 'Test case details'
      : (links.find(([, url]) => isCurrent(url))?.[0] ?? 'Project workspace');
  return (
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
                    <p>{me.data?.email}</p>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setProfile(false);
                        nav('/change-password');
                      }}
                    >
                      Change password
                    </Button>
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
  );
}
