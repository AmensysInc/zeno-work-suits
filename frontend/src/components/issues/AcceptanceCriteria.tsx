import { Card, Checkbox, Input, Typography } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useData, useSave } from '../../hooks/data';
import type { Criterion } from '../../types';
import { State } from '../ui/shared';
import { Button } from '../ui/button';
import { confirm } from '../ui/confirm';
function Row({
  item,
  onMove,
  first,
  last,
}: {
  item: Criterion;
  onMove: (direction: number) => void;
  first: boolean;
  last: boolean;
}) {
  const save = useSave(`/acceptance-criteria/${item.id}`, 'put');
  const del = useSave(
    `/acceptance-criteria/${item.id}`,
    'delete',
    'Criterion deleted',
  );
  return (
    <div className="criterion">
      <Checkbox
        aria-label={item.description}
        checked={item.completed}
        disabled={save.isPending}
        onChange={(e) => save.mutate({ ...item, completed: e.target.checked })}
      />
      <Typography.Text
        className={item.completed ? 'checked' : ''}
        editable={{
          tooltip: 'Edit acceptance criterion',
          onChange: (description) => {
            if (description.trim() && description !== item.description)
              save.mutate({ ...item, description });
          },
        }}
      >
        {item.description}
      </Typography.Text>
      <div className="actions">
        <Button
          variant="ghost"
          size="small"
          icon={<ArrowUpOutlined />}
          aria-label="Move criterion up"
          disabled={first}
          onClick={() => onMove(-1)}
        />
        <Button
          variant="ghost"
          size="small"
          icon={<ArrowDownOutlined />}
          aria-label="Move criterion down"
          disabled={last}
          onClick={() => onMove(1)}
        />
        <Button
          variant="ghost"
          size="small"
          icon={<DeleteOutlined />}
          aria-label="Delete criterion"
          onClick={async () => {
            if (await confirm('Delete this criterion?', { okText: 'Delete' }))
              del.mutate({});
          }}
        />
      </div>
    </div>
  );
}
export default function AcceptanceCriteria({ issueId }: { issueId: number }) {
  const path = `/issues/${issueId}/acceptance-criteria`;
  const query = useData<Criterion[]>(path);
  const save = useSave(path, 'post', 'Criterion added');
  const reorder = useSave('/acceptance-criteria/reorder', 'post');
  const items = query.data ?? [];
  return (
    <Card
      className="card"
      title="Acceptance criteria"
      extra={
        <Typography.Text type="secondary">
          {items.filter((c) => c.completed).length}/{items.length} done
        </Typography.Text>
      }
    >
      <State loading={query.isLoading} error={query.error} />
      {items.map((c, index) => (
        <Row
          key={c.id}
          item={c}
          first={index === 0}
          last={index === items.length - 1}
          onMove={(direction) => {
            const ids = items.map((x) => x.id);
            [ids[index], ids[index + direction]] = [
              ids[index + direction],
              ids[index],
            ];
            reorder.mutate({ issue_id: issueId, ids });
          }}
        />
      ))}
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          try {
            await save.mutateAsync({
              description: new FormData(form).get('description'),
              order_index: items.length,
            });
            form.reset();
          } catch {
            /*toast*/
          }
        }}
      >
        <Input
          name="description"
          required
          aria-label="New acceptance criterion"
          placeholder="Add an acceptance criterion…"
        />
        <Button type="submit" loading={save.isPending}>
          Add
        </Button>
      </form>
    </Card>
  );
}
