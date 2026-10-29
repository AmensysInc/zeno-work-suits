'use client';

import { useData } from '@/hooks/data';
import { label, type Activity } from '@/types';
import { Avatar, State } from '@/components/ui/display';

export default function ActivityHistory({ issueId }: { issueId: number }) {
  const query = useData<Activity[]>(`/issues/${issueId}/activity`);
  return (
    <div>
      <State loading={query.isLoading} error={query.error} empty={query.data?.length === 0} emptyText="No activity yet." />
      <ol className="relative flex flex-col gap-4 pl-1">
        {query.data?.map((a) => (
          <li key={a.id} className="flex gap-3">
            <Avatar user={a.user} size={24} />
            <div className="flex min-w-0 flex-col gap-0.5 text-[13px]">
              <span>
                <b className="font-semibold">
                  {a.user.first_name} {a.user.last_name}
                </b>{' '}
                <span className="text-ink-2">
                  {a.action} {a.field_name && label(a.field_name)}
                </span>
              </span>
              {(a.old_value || a.new_value) && (
                <span className="text-ink-2">
                  <span className="text-ink-3 line-through decoration-ink-4">{a.old_value ?? 'None'}</span> → {a.new_value ?? 'None'}
                </span>
              )}
              <span className="text-[11.5px] text-ink-3">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
