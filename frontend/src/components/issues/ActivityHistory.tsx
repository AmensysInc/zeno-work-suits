import { useData } from '../../hooks/data';
import { type Activity, label } from '../../types';
import { State } from '../ui/shared';
export default function ActivityHistory({ issueId }: { issueId: number }) {
  const query = useData<Activity[]>(`/issues/${issueId}/activity`);
  return (
    <section className="card">
      <h2>Activity history</h2>
      <State
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.length === 0}
      />
      {query.data?.map((a) => (
        <div className="activity" key={a.id}>
          <div className="activity-dot" />
          <div>
            <strong>
              {a.user.first_name} {a.user.last_name}
            </strong>{' '}
            {a.action} {a.field_name && label(a.field_name)}
            {(a.old_value || a.new_value) && (
              <p>
                {a.old_value ?? 'None'} → {a.new_value ?? 'None'}
              </p>
            )}
            <small>{new Date(a.created_at).toLocaleString()}</small>
          </div>
        </div>
      ))}
    </section>
  );
}
