import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '../services/api';
import type { Issue, Project, User } from '../types';
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
