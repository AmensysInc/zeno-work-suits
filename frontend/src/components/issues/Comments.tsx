import { useState } from 'react';
import { Avatar, Card, Input, Typography } from 'antd';
import { useData, useMe, useSave } from '../../hooks/data';
import type { Comment } from '../../types';
import { State } from '../ui/shared';
import { Button } from '../ui/button';
import { confirm } from '../ui/confirm';
function CommentRow({ comment, own }: { comment: Comment; own: boolean }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);
  const save = useSave(`/comments/${comment.id}`, 'put', 'Comment updated');
  const del = useSave(`/comments/${comment.id}`, 'delete', 'Comment deleted');
  return (
    <article className="comment">
      <Avatar size={32} className="profile-avatar">
        {comment.user.first_name[0]}
        {comment.user.last_name[0]}
      </Avatar>
      <div className="comment-body">
        <div className="section-head">
          <Typography.Text strong>
            {comment.user.first_name} {comment.user.last_name}
          </Typography.Text>
          <Typography.Text type="secondary">
            {new Date(comment.created_at).toLocaleString()}
          </Typography.Text>
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
            <Input.TextArea
              aria-label="Edit comment"
              required
              autoSize={{ minRows: 3 }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="actions form-footer">
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={save.isPending}>
                Save
              </Button>
            </div>
          </form>
        ) : (
          <p className="prewrap">{comment.body}</p>
        )}
        {own && !editing && (
          <div className="actions">
            <Button
              variant="ghost"
              size="small"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="small"
              onClick={async () => {
                if (await confirm('Delete this comment?', { okText: 'Delete' }))
                  del.mutate({});
              }}
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
export default function Comments({ issueId }: { issueId: number }) {
  const query = useData<Comment[]>(`/issues/${issueId}/comments`);
  const me = useMe();
  const save = useSave(`/issues/${issueId}/comments`, 'post', 'Comment added');
  return (
    <Card className="card" title="Comments">
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
        <Input.TextArea
          aria-label="New comment"
          name="body"
          required
          autoSize={{ minRows: 3 }}
          placeholder="Share an update with your team…"
        />
        <div className="form-footer actions">
          <Button type="submit" loading={save.isPending}>
            Add comment
          </Button>
        </div>
      </form>
    </Card>
  );
}
