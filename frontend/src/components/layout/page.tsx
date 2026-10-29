'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Menu as MenuIcon } from 'lucide-react';
import { useData } from '@/hooks/data';
import { cn } from '@/lib/utils';
import type { Project } from '@/types';
import { ProjectMark } from '@/components/ui/display';
import { useOpenNav } from './context';

type Crumb = string | { label: string; href: string };

/** The 48px bar at the top of every page: breadcrumb on the left, actions on the right. */
export function PageBar({
  crumbs,
  projectId,
  actions,
}: {
  crumbs: Crumb[];
  projectId?: number;
  actions?: ReactNode;
}) {
  const openNav = useOpenNav();
  const project = useData<Project>(`/projects/${projectId}`, !!projectId);
  const all: Crumb[] = project.data ? [{ label: project.data.name, href: `/projects/${project.data.id}` }, ...crumbs] : crumbs;
  return (
    <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-3 sm:px-4 lg:pl-[18px]">
      <button aria-label="Open navigation" onClick={openNav} className="flex size-7 items-center justify-center rounded-md text-ink-2 hover:bg-hover lg:hidden">
        <MenuIcon className="size-4" />
      </button>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-ink-2">
        {project.data && <ProjectMark project={project.data} size={16} />}
        {all.map((c, i) => {
          const last = i === all.length - 1;
          const text = typeof c === 'string' ? c : c.label;
          return (
            <span key={i} className={cn('flex min-w-0 items-center gap-1.5', !last && 'hidden sm:flex')}>
              {typeof c !== 'string' && !last ? (
                <Link href={c.href} className="truncate hover:text-ink">
                  {text}
                </Link>
              ) : (
                <span className={cn('truncate', last && 'font-semibold text-ink')}>{text}</span>
              )}
              {!last && <span className="text-ink-4">/</span>}
            </span>
          );
        })}
      </nav>
      <div className="flex-1" />
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Secondary toolbar under the page bar (filters, view switches). */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1.5 sm:px-[18px]', className)}>
      {children}
    </div>
  );
}

/** Scrollable page body. */
export function PageBody({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={cn('scrollbar-thin min-h-0 flex-1 overflow-y-auto', padded && 'px-4 py-5 sm:px-7', className)}>
      {children}
    </div>
  );
}

/** Page title and description inside the body. */
export function PageTitle({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-[13px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
