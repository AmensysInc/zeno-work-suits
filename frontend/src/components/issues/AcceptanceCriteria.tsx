import { useData, useSave } from '../../hooks/data';
import type { Criterion } from '../../types';
import { State } from '../ui/shared';
import { Button } from '../ui/button';
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
      <input
        type="checkbox"
        aria-label={item.description}
        checked={item.completed}
        disabled={save.isPending}
        onChange={(e) => save.mutate({ ...item, completed: e.target.checked })}
      />
      <span className={item.completed ? 'checked' : ''}>
        {item.description}
      </span>
      <div className="actions">
        <button
          aria-label="Move criterion up"
          disabled={first}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          aria-label="Move criterion down"
          disabled={last}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
        <button
          onClick={() => {
            const description = window.prompt(
              'Edit acceptance criterion',
              item.description,
            );
            if (description?.trim()) save.mutate({ ...item, description });
          }}
        >
          Edit
        </button>
        <button
          onClick={() => {
            if (window.confirm('Delete this criterion?')) del.mutate({});
          }}
        >
          ×
        </button>
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
    <section className="card">
      <h2>
        Acceptance criteria{' '}
        <span className="muted">
          {items.filter((c) => c.completed).length}/{items.length}
        </span>
      </h2>
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
        <input
          name="description"
          required
          aria-label="New acceptance criterion"
          placeholder="Add an acceptance criterion…"
        />
        <Button type="submit" disabled={save.isPending}>
          Add
        </Button>
      </form>
    </section>
  );
}
