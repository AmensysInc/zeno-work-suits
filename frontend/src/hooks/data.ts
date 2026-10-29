'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { canLeadProject, type Issue, type Project, type User } from '@/types';

export function useData<T>(path: string, enabled = true) {
  return useQuery<T>({
    queryKey: [path],
    queryFn: async () => (await api.get<T>(path)).data,
    enabled,
  });
}
export const useProjects = () => useData<Project[]>('/projects');
export const useMe = () => useData<User>('/auth/me');
export const useIssues = (projectId?: number) =>
  useData<Issue[]>(`/issues${projectId ? `?project_id=${projectId}` : ''}`);

/** Whether the signed-in person may run sprints and delete work in a project. */
export function useCanLead(projectId?: number) {
  const me = useMe();
  const projects = useProjects();
  const project = projects.data?.find((p) => p.id === projectId);
  return !!project && canLeadProject(me.data, project);
}

export function useSave<T = unknown>(
  path: string,
  method: 'post' | 'put' | 'patch' | 'delete' = 'post',
  message = 'Saved',
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: T) =>
      (await api.request({ url: path, method, data })).data,
    onSuccess: () => {
      qc.invalidateQueries();
      if (message) toast.success(message);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
