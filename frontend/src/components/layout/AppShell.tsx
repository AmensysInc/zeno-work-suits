import { useState, createContext, useContext, lazy, Suspense } from 'react';
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
  const match = location.pathname.match(/projects\/(\d+)/);
  const projectId = match ? Number(match[1]) : projects.data?.[0]?.id;
  const links = [
    ['Dashboard', '/dashboard'],
    ['Projects', '/projects'],
    ['Backlog', projectId ? `/projects/${projectId}/backlog` : '/projects'],
    ['Sprints', projectId ? `/projects/${projectId}/sprints` : '/projects'],
    ['Board', projectId ? `/projects/${projectId}/board` : '/projects'],
    ['My Issues', '/my-issues'],
    ['Test Cases', '/test-cases'],
  ];
  const title = location.pathname.includes('/issues/')
    ? 'Issue details'
    : location.pathname.startsWith('/test-cases/')
      ? location.pathname.endsWith('/new')
        ? 'Add Test Case'
        : 'Test case details'
      : (links.find(([, url]) => url === location.pathname)?.[0] ??
        'Project workspace');
  return (
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
          <nav>
            {links.map(([name, url]) => (
              <NavLink
                key={name}
                aria-label={name}
                title={name}
                onClick={() => { if (window.innerWidth <= 900) setCollapsed(false); }}
                to={url}
                end
                className={({ isActive }) =>
                  isActive ? 'nav-link active' : 'nav-link'
                }
              >
                <img
                  alt=""
                  src={`/assets/${location.pathname === url ? 'imgEllipse' : 'imgEllipse1'}.svg`}
                />
                <span>{name}</span>
              </NavLink>
            ))}
          </nav>
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
  );
}
