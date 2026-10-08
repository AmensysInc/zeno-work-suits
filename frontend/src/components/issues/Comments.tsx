import { useState } from 'react';
import { useData, useMe, useSave } from '../../hooks/data';
import type { Comment } from '../../types';
import { State } from '../ui/shared';
import { Button } from '../ui/button';
function CommentRow({ comment, own }: { comment: Comment; own: boolean }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const save = useSave(`/comments/${comment.id}`, 'put', 'Comment updated');
  const del = useSave(`/comments/${comment.id}`, 'delete', 'Comment deleted');
  return (
    <article className="comment">
      <div className="section-head">
        <strong>
          {comment.user.first_name} {comment.user.last_name}
        </strong>
        <span className="muted">
          {new Date(comment.created_at).toLocaleString()}
        </span>
      </div>
      {editing ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await save.mutateAsync({ body });
              setEditing(false);
            } catch {
              /*toast*/
            }
          }}
        >
          <textarea
            aria-label="Edit comment"
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="actions">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              Save
            </Button>
          </div>
        </form>
      ) : (
        <p className="prewrap">{comment.body}</p>
      )}
      {own && !editing && (
        <div className="actions">
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm('Delete this comment?')) del.mutate({});
            }}
          >
            Delete
          </Button>
        </div>
      )}
    </article>
  );
}
export default function Comments({ issueId }: { issueId: number }) {
  const query = useData<Comment[]>(`/issues/${issueId}/comments`);
  const me = useMe();
  const save = useSave(`/issues/${issueId}/comments`, 'post', 'Comment added');
  return (
    <section className="card">
      <h2>Comments</h2>
      <State loading={query.isLoading} error={query.error} />
      {query.data?.map((c) => (
        <CommentRow key={c.id} comment={c} own={c.user_id === me.data?.id} />
      ))}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          try {
            await save.mutateAsync({ body: new FormData(form).get('body') });
            form.reset();
          } catch {
            /*toast*/
          }
        }}
      >
        <textarea
          aria-label="New comment"
          name="body"
          required
          placeholder="Share an update with your team…"
        />
        <div className="form-footer actions">
          <Button type="submit" disabled={save.isPending}>
            Add comment
          </Button>
        </div>
      </form>
    </section>
  );
}
