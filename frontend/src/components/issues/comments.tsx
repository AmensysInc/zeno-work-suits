'use client';

import { useState } from 'react';
import { useCanLead, useData, useMe, useSave } from '@/hooks/data';
import type { Comment } from '@/types';
import { Avatar, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { confirm } from '@/components/ui/confirm';

function CommentRow({ comment, own, moderate }: { comment: Comment; own: boolean; moderate: boolean }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const save = useSave(`/comments/${comment.id}`, 'put', 'Comment updated');
  const del = useSave(`/comments/${comment.id}`, 'delete', 'Comment deleted');
  return (
    <article className="flex gap-3">
      <Avatar user={comment.user} size={28} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold">
            {comment.user.first_name} {comment.user.last_name}
          </span>
          <span className="text-[11.5px] text-ink-3">{new Date(comment.created_at).toLocaleString()}</span>
        </div>
        {editing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await save.mutateAsync({ body });
                setEditing(false);
              } catch {
                /* toast */
              }
            }}
          >
            <Textarea aria-label="Edit comment" required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit" loading={save.isPending}>
                Save
              </Button>
            </div>
          </form>
        ) : (
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{comment.body}</p>
        )}
        {(own || moderate) && !editing && (
          <div className="flex gap-3 text-xs text-ink-3">
            {own && (
              <button className="hover:text-ink" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            <button
              className="hover:text-red-600"
              onClick={async () => {
                if (await confirm('Delete this comment?', { okText: 'Delete' })) del.mutate({});
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function Comments({ issueId, projectId }: { issueId: number; projectId: number }) {
  const query = useData<Comment[]>(`/issues/${issueId}/comments`);
  const me = useMe();
  const canLead = useCanLead(projectId);
  const save = useSave(`/issues/${issueId}/comments`, 'post', 'Comment added');
  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          try {
            await save.mutateAsync({ body: new FormData(form).get('body') });
            form.reset();
          } catch {
            /* toast */
          }
        }}
      >
        <Avatar user={me.data} size={28} />
        <div className="flex flex-1 flex-col gap-2">
          <Textarea aria-label="New comment" name="body" required rows={3} placeholder="Share an update with your team…" />
          <Button type="submit" variant="primary" size="sm" className="self-end" loading={save.isPending}>
            Add comment
          </Button>
        </div>
      </form>
      <State loading={query.isLoading} error={query.error} />
      {query.data?.map((c) => (
        <CommentRow key={c.id} comment={c} own={c.user_id === me.data?.id} moderate={canLead} />
      ))}
    </div>
  );
}
