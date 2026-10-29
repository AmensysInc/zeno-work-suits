'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useData, useSave } from '@/hooks/data';
import type { Criterion } from '@/types';
import { Card, CardHeader, State } from '@/components/ui/display';
import { Checkbox } from '@/components/ui/controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { confirm } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';

function Row({ item, index, onMove, first, last }: { item: Criterion; index: number; onMove: (d: number) => void; first: boolean; last: boolean }) {
  const save = useSave(`/acceptance-criteria/${item.id}`, 'put');
  const del = useSave(`/acceptance-criteria/${item.id}`, 'delete', 'Criterion deleted');
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.description);
  const commit = () => {
    setEditing(false);
    if (text.trim() && text !== item.description) save.mutate({ ...item, description: text.trim() });
    else setText(item.description);
  };
  return (
    <div className="group flex min-h-[42px] items-center gap-2.5 border-t border-line px-4">
      <span className="tnum w-3.5 text-xs text-ink-3">{index + 1}</span>
      <Checkbox
        aria-label={item.description}
        checked={item.completed}
        disabled={save.isPending}
        onChange={(completed) => save.mutate({ ...item, completed })}
      />
      {editing ? (
        <Input
          size="sm"
          autoFocus
          className="flex-1"
          value={text}
          aria-label="Edit acceptance criterion"
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setText(item.description);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span className={cn('flex-1 text-[13px]', item.completed && 'text-ink-3 line-through')}>{item.description}</span>
      )}
      <div className="flex items-center opacity-60 group-hover:opacity-100">
        <Button size="icon" variant="ghost" aria-label="Edit acceptance criterion" onClick={() => setEditing(true)}>
          <Pencil />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Move criterion up" disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp />
        </Button>
        <Button size="icon" variant="ghost" aria-label="Move criterion down" disabled={last} onClick={() => onMove(1)}>
          <ArrowDown />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Delete criterion"
          onClick={async () => {
            if (await confirm('Delete this criterion?', { okText: 'Delete' })) del.mutate({});
          }}
        >
          <Trash2 />
        </Button>
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
    <Card>
      <CardHeader className="pb-2.5" title="Acceptance criteria" subtitle={`${items.filter((c) => c.completed).length} of ${items.length} done`} />
      <State loading={query.isLoading} error={query.error} />
      {items.map((c, index) => (
        <Row
          key={c.id}
          item={c}
          index={index}
          first={index === 0}
          last={index === items.length - 1}
          onMove={(d) => {
            const ids = items.map((x) => x.id);
            [ids[index], ids[index + d]] = [ids[index + d], ids[index]];
            reorder.mutate({ issue_id: issueId, ids });
          }}
        />
      ))}
      <form
        className="flex items-center gap-2 border-t border-line px-4 py-2.5"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          try {
            await save.mutateAsync({ description: new FormData(form).get('description'), order_index: items.length });
            form.reset();
          } catch {
            /* toast */
          }
        }}
      >
        <Input name="description" required size="sm" className="flex-1" aria-label="New acceptance criterion" placeholder="Add an acceptance criterion…" />
        <Button type="submit" size="sm" loading={save.isPending} icon={<Plus />}>
          Add
        </Button>
      </form>
    </Card>
  );
}
