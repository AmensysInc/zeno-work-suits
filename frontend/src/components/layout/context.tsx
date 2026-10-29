'use client';

import { createContext, useContext, useEffect } from 'react';
import type { Issue } from '@/types';

export const CreateContext = createContext<(initial?: Partial<Issue>) => void>(() => {});
/** Opens the create/edit issue dialog with optional prefilled fields. */
export const useCreateIssue = () => useContext(CreateContext);

export const ProjectContext = createContext<number | undefined>(undefined);
/**
 * The project in the URL, else the last one visited this session. Undefined
 * until the person picks one, so nothing is preselected right after sign-in.
 */
export const useCurrentProject = () => useContext(ProjectContext);

export const PageProjectContext = createContext<(id?: number) => void>(() => {});
/**
 * For pages whose URL has no project (issue and test case details): marks the
 * project the page belongs to, so the sidebar and switcher follow it.
 */
export function usePageProject(id?: number) {
  const set = useContext(PageProjectContext);
  useEffect(() => {
    set(id);
    return () => set(undefined);
  }, [id, set]);
}

export const NavContext = createContext<() => void>(() => {});
/** Opens the navigation drawer on narrow screens. */
export const useOpenNav = () => useContext(NavContext);
