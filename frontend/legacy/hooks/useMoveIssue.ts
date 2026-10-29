import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../services/api';
import { toast } from 'sonner';
import type { Issue } from '../types';
export function useMoveIssue(projectId: number) {
  const qc = useQueryClient();
  const key = [`/issues?project_id=${projectId}`];
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Issue> }) =>
      (await api.put(`/issues/${id}`, patch)).data,
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Issue[]>(key);
      qc.setQueryData<Issue[]>(key, (items) =>
        items?.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      );
      return { previous };
    },
    onError: (error, _, context) => {
      qc.setQueryData(key, context?.previous);
      toast.error(errorMessage(error));
    },
    onSettled: () => qc.invalidateQueries(),
  });
}
