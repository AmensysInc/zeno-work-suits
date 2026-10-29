import { Card, Timeline, Typography } from 'antd';
import { useData } from '../../hooks/data';
import { type Activity, label } from '../../types';
import { State } from '../ui/shared';
export default function ActivityHistory({ issueId }: { issueId: number }) {
  const query = useData<Activity[]>(`/issues/${issueId}/activity`);
  return (
    <Card className="card" title="Activity history">
      <State
        loading={query.isLoading}
        error={query.error}
        empty={query.data?.length === 0}
      />
      <Timeline
        className="activity"
        items={query.data?.map((a) => ({
          key: a.id,
          content: (
            <>
              <Typography.Text strong>
                {a.user.first_name} {a.user.last_name}
              </Typography.Text>{' '}
              {a.action} {a.field_name && label(a.field_name)}
              {(a.old_value || a.new_value) && (
                <p>
                  {a.old_value ?? 'None'} → {a.new_value ?? 'None'}
                </p>
              )}
              <Typography.Text type="secondary" className="activity-time">
                {new Date(a.created_at).toLocaleString()}
              </Typography.Text>
            </>
          ),
        }))}
      />
    </Card>
  );
}
