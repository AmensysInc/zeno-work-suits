import { api } from '@/lib/api';
import type { IssueAttachment } from '@/types';

export async function uploadIssueAttachments(issueId: number, files: File[]) {
  if (!files.length) return [] as IssueAttachment[];
  const body = new FormData();
  for (const file of files) body.append('files', file);
  return (await api.post<IssueAttachment[]>(`/issues/${issueId}/attachments`, body)).data;
}

/** Fetches with the session token, then triggers a browser download. */
export async function downloadAttachment(id: number, filename: string) {
  const res = await api.get<Blob>(`/attachments/${id}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
