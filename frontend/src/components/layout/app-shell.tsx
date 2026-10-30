'use client';

import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Bug,
  ChevronsUpDown,
  CirclePlay,
  FlaskConical,
  Folder,
  House,
  KeyRound,
  Kanban,
  LayoutGrid,
  List,
  LogOut,
  MessageSquare,
  Mic,
  Monitor,
  Moon,
  MoreHorizontal,
  Network,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Sun,
  Table2,
  Timer,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { useMe, useProjects } from '@/hooks/data';
import { PROJECT_KEY, clearSession } from '@/lib/api';
import { cn } from '@/lib/utils';
import { label, type Issue, type Project } from '@/types';
import { Avatar, ProjectMark } from '@/components/ui/display';
import { GithubIcon } from '@/components/ui/glyphs';
import { Input } from '@/components/ui/input';
import { Menu, Popover } from '@/components/ui/controls';
import { useTheme } from './theme';
import { CreateContext, NavContext, PageProjectContext, ProjectContext } from './context';

const CreateIssueDialog = lazy(() => import('@/components/issues/create-issue-dialog'));

/** Pages outside /projects/:id that carry their project as ?project=. */
const projectQueryPages = ['/test-cases', '/chat', '/ai-generator', '/github'];

const remembered = () => {
  try {
    return Number(localStorage.getItem(PROJECT_KEY)) || undefined;
  } catch {
    return undefined;
  }
};

type Item = { name: string; href: string; icon: ReactNode; match?: string[] };

function NavItem({ item, active, onNavigate }: { item: Item; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink [&_svg]:size-[15px] [&_svg]:text-ink-3',
        active && 'bg-surface text-ink shadow-sm ring-1 ring-line [&_svg]:text-accent',
      )}
    >
      {item.icon}
      <span className="truncate">{item.name}</span>
    </Link>
  );
}

function ProjectSwitcher({
  projects,
  current,
  onPick,
}: {
  projects: Project[];
  current?: Project;
  onPick: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const shown = projects.filter((p) => `${p.name} ${p.key}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ('');
      }}
      className="w-[260px]"
      trigger={
        <button
          aria-label="Project"
          className={cn(
            'my-1.5 flex w-full items-center gap-2.5 rounded-[9px] border border-line bg-surface px-2 py-[7px] text-left shadow-sm hover:border-line-2',
            !current && 'border-dashed shadow-none',
          )}
        >
          {current ? (
            <ProjectMark project={current} size={20} />
          ) : (
            <span className="flex size-5 items-center justify-center rounded-[5px] bg-hover text-ink-3">
              <Plus className="size-3" />
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn('truncate text-[13px] font-semibold', !current && 'font-medium text-ink-2')}>
              {current?.name ?? (projects.length ? 'Select project' : 'No projects')}
            </span>
            {current && (
              <span className="font-mono text-[11px] text-ink-3">
                {current.key} · {current.board_type === 'KANBAN' ? 'Kanban' : 'Scrum'}
              </span>
            )}
          </span>
          <ChevronsUpDown className="size-3.5 text-ink-3" />
        </button>
      }
    >
      <div className="p-1">
        <Input size="sm" icon={<Search />} placeholder="Find a project…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      <div className="scrollbar-thin max-h-72 overflow-y-auto">
        {shown.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              onPick(p.id);
              setOpen(false);
            }}
            className={cn('flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover', p.id === current?.id && 'bg-hover')}
          >
            <ProjectMark project={p} size={18} />
            <span className="flex-1 truncate">{p.name}</span>
            <span className="font-mono text-[11px] text-ink-3">{p.key}</span>
          </button>
        ))}
        {!shown.length && <p className="px-2 py-3 text-center text-xs text-ink-3">No projects match.</p>}
      </div>
      <div className="mt-1 border-t border-line pt-1">
        <Link href="/projects" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-ink-2 hover:bg-hover">
          <Folder className="size-3.5" />
          All projects
        </Link>
      </div>
    </Popover>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const projects = useProjects();
  const me = useMe();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { choice, setChoice } = useTheme();
  const [create, setCreate] = useState<Partial<Issue> | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [lastProject, setLastProject] = useState<number>();
  const [pageProject, setPageProject] = useState<number>();

  useEffect(() => setLastProject(remembered()), []);
  useEffect(() => setDrawer(false), [pathname]);

  const match = pathname.match(/^\/projects\/(\d+)/);
  const fromUrl = match ? Number(match[1]) : Number(params.get('project')) || pageProject;

  // A temporary password from an admin must be replaced before using the app.
  useEffect(() => {
    if (me.data?.must_change_password) router.replace('/change-password');
  }, [me.data?.must_change_password, router]);

  useEffect(() => {
    if (!fromUrl) return;
    setLastProject(fromUrl);
    try {
      localStorage.setItem(PROJECT_KEY, String(fromUrl));
    } catch {
      /* storage unavailable */
    }
  }, [fromUrl]);

  const projectId = [fromUrl, lastProject].find((id) => projects.data?.some((p) => p.id === id));
  const project = projects.data?.find((p) => p.id === projectId);
  const withProject = (page: string) => (projectId ? `${page}?project=${projectId}` : page);
  const inProject = (page: string) => `/projects/${projectId}${page ? `/${page}` : ''}`;

  /** Shows the same page for another project, else that project's overview. */
  const switchProject = (id: number) => {
    const projectPage = pathname.match(/^\/projects\/(\d+)(\/[\w-]*)?$/);
    if (projectPage) {
      router.push(`/projects/${id}${projectPage[2] ?? ''}`);
    } else if (projectQueryPages.includes(pathname)) {
      const next = new URLSearchParams(params);
      next.set('project', String(id));
      router.push(`${pathname}?${next}`);
    } else {
      router.push(`/projects/${id}`);
    }
  };

  const signOut = () => {
    clearSession();
    qc.clear();
    router.replace('/login');
  };

  const isActive = (href: string) => href.split('?')[0] === pathname;
  const close = () => setDrawer(false);
  const projectItems: Item[] = projectId
    ? [
        { name: 'Overview', href: inProject(''), icon: <LayoutGrid /> },
        { name: 'Backlog', href: inProject('backlog'), icon: <List /> },
        { name: 'Sprints', href: inProject('sprints'), icon: <Timer /> },
        { name: 'Board', href: inProject('board'), icon: <Kanban /> },
        { name: 'Work items', href: inProject('work-items'), icon: <Table2 /> },
        { name: 'Epics', href: inProject('epics'), icon: <Zap /> },
        { name: 'Reports', href: inProject('reports'), icon: <BarChart3 /> },
        { name: 'Settings', href: inProject('settings'), icon: <Settings /> },
      ]
    : [];
  const qualityItems: Item[] = projectId
    ? [
        { name: 'QA dashboard', href: inProject('quality'), icon: <ShieldCheck /> },
        { name: 'Test repository', href: inProject('test-cases'), icon: <FlaskConical /> },
        { name: 'Test runs', href: inProject('test-runs'), icon: <CirclePlay /> },
        { name: 'Bugs', href: inProject('bugs'), icon: <Bug /> },
        { name: 'Traceability', href: inProject('traceability'), icon: <Network /> },
        { name: 'AI generator', href: withProject('/ai-generator'), icon: <Sparkles /> },
      ]
    : [];
  const workspaceItems: Item[] = [
    { name: 'Chats', href: withProject('/chat'), icon: <MessageSquare /> },
    { name: 'Automations', href: '/automations', icon: <Zap /> },
    { name: 'GitHub', href: withProject('/github'), icon: <GithubIcon /> },
    { name: 'Speech to text', href: '/voice-agent', icon: <Mic /> },
    ...(me.data?.role === 'ADMIN' ? [{ name: 'People', href: '/admin/users', icon: <Users /> }] : []),
  ];
  const section = (title: string, items: Item[]) =>
    items.length ? (
      <>
        <div className="px-2 pb-[3px] pt-2.5 text-[11px] font-semibold text-ink-3">{title}</div>
        {items.map((i) => (
          <NavItem key={i.name} item={i} active={isActive(i.href)} onNavigate={close} />
        ))}
      </>
    ) : null;

  const sidebar = (
    <aside className="flex h-full w-[244px] shrink-0 flex-col gap-px overflow-y-auto p-2.5 scrollbar-thin">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.5">
          <span className="flex size-6 items-center justify-center rounded-[7px] bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.18)]">
            Z
          </span>
          <span className="truncate text-[13.5px] font-semibold tracking-tight">Zeno TeamSuite</span>
        </Link>
        <div className="flex items-center gap-0.5">
          <Link href="/my-issues?q=" aria-label="Search issues" className="flex size-7 items-center justify-center rounded-md text-ink-2 hover:bg-hover">
            <Search className="size-[15px]" />
          </Link>
          <button
            aria-label="Create issue"
            onClick={() => setCreate(projectId ? { project_id: projectId } : {})}
            className="flex size-7 items-center justify-center rounded-md border border-line bg-surface text-ink-2 hover:bg-hover"
          >
            <SquarePen className="size-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-1.5" />
      <NavItem item={{ name: 'Home', href: '/dashboard', icon: <House /> }} active={isActive('/dashboard')} onNavigate={close} />
      <NavItem item={{ name: 'My issues', href: '/my-issues', icon: <User /> }} active={isActive('/my-issues')} onNavigate={close} />
      <NavItem item={{ name: 'Projects', href: '/projects', icon: <Folder /> }} active={isActive('/projects')} onNavigate={close} />
      <ProjectSwitcher projects={projects.data ?? []} current={project} onPick={switchProject} />
      {projectId ? (
        <>
          {section('Project', projectItems)}
          {section('Quality', qualityItems)}
        </>
      ) : (
        <div className="flex flex-col items-center gap-1.5 px-2.5 py-5 text-center">
          <Folder className="size-5 text-ink-3" />
          <span className="text-[12.5px] font-medium">No project selected</span>
          <span className="max-w-[180px] text-[11.5px] text-ink-3">Pick a project above to see its backlog, sprints and quality pages.</span>
        </div>
      )}
      {section('Workspace', workspaceItems)}
      <div className="mt-auto pt-3">
        <Menu
          align="start"
          trigger={
            <button className="flex w-full items-center gap-2.5 rounded-[9px] p-2 text-left hover:bg-hover">
              <Avatar user={me.data} size={26} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[12.5px] font-semibold">
                  {me.data ? `${me.data.first_name} ${me.data.last_name}` : ''}
                </span>
                <span className="text-[11.5px] text-ink-3">{me.data ? label(me.data.role) : ''}</span>
              </span>
              <MoreHorizontal className="size-[15px] text-ink-3" />
            </button>
          }
          items={[
            { label: 'Change password', icon: <KeyRound />, onSelect: () => router.push('/change-password') },
            'separator',
            { label: `Light${choice === 'light' ? ' ✓' : ''}`, icon: <Sun />, onSelect: () => setChoice('light') },
            { label: `Dark${choice === 'dark' ? ' ✓' : ''}`, icon: <Moon />, onSelect: () => setChoice('dark') },
            { label: `System${choice === 'system' ? ' ✓' : ''}`, icon: <Monitor />, onSelect: () => setChoice('system') },
            'separator',
            { label: 'Sign out', icon: <LogOut />, onSelect: signOut },
          ]}
        />
      </div>
    </aside>
  );

  const openCreate = useCallback((initial?: Partial<Issue>) => setCreate(initial ?? {}), []);
  return (
    <PageProjectContext.Provider value={setPageProject}>
      <ProjectContext.Provider value={projectId}>
        <CreateContext.Provider value={openCreate}>
          <NavContext.Provider value={() => setDrawer(true)}>
            <div className="flex h-dvh bg-app">
              <div className="hidden lg:flex">{sidebar}</div>
              {drawer && (
                <div className="fixed inset-0 z-40 lg:hidden">
                  <div className="absolute inset-0 bg-[var(--overlay)]" onClick={close} />
                  <div className="absolute inset-y-0 left-0 flex bg-app shadow-lg">{sidebar}</div>
                </div>
              )}
              <main className="m-0 flex min-w-0 flex-1 flex-col overflow-hidden border-line bg-surface lg:my-2 lg:mr-2 lg:rounded-xl lg:border lg:shadow-md">
                {children}
              </main>
            </div>
            {create && (
              <Suspense fallback={null}>
                <CreateIssueDialog initial={create} onClose={() => setCreate(null)} />
              </Suspense>
            )}
          </NavContext.Provider>
        </CreateContext.Provider>
      </ProjectContext.Provider>
    </PageProjectContext.Provider>
  );
}
