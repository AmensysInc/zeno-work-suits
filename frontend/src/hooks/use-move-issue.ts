'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import type { Issue } from '@/types';

/** Updates an issue with an optimistic change to the project's issue list. */
export function useMoveIssue(projectId: number) {
  const qc = useQueryClient();
  const key = [`/issues?project_id=${projectId}`];
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Issue> }) => (await api.put(`/issues/${id}`, patch)).data,
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Issue[]>(key);
      qc.setQueryData<Issue[]>(key, (items) => items?.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      return { previous };
    },
    onError: (error, _, context) => {
      qc.setQueryData(key, context?.previous);
      toast.error(errorMessage(error));
    },
    onSettled: () => qc.invalidateQueries(),
  });
}
