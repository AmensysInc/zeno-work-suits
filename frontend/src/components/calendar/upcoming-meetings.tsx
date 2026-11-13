'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { Card, CardHeader, Empty, State } from '@/components/ui/display';
import { MeetingDetails, MeetingForm, MeetingRow } from '@/components/calendar/meeting-ui';
import { api } from '@/lib/api';
import { addDays, startOfDay } from '@/lib/meetings';
import type { Meeting } from '@/types';

const SHOWN = 5;

/** Home page card: the person's meetings from now through the next 7 days. */
export default function UpcomingMeetings() {
  const [opened, setOpened] = useState<Meeting | null>(null);
  const [editing, setEditing] = useState<Meeting | null>(null);
  // Whole days keep the query key stable between renders.
  const start = startOfDay(new Date());
  const end = addDays(start, 8);
  const path = `/meetings?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
  const meetings = useQuery<Meeting[]>({
    queryKey: [path],
    queryFn: async () => (await api.get<Meeting[]>(path)).data,
    refetchInterval: 60_000,
  });
  // "Now" is when the list was last fetched (every minute), so rendering stays pure.
  const upcoming = (meetings.data ?? []).filter((m) => new Date(m.ends_at).getTime() > meetings.dataUpdatedAt);
  return (
    <Card>
      <CardHeader
        title="Upcoming meetings"
        subtitle="Today and the next 7 days"
        action={
          <Link href="/calendar" className="text-[12.5px] font-medium text-accent-ink hover:underline">
            Open calendar
          </Link>
        }
      />
      <div className="p-3">
        <State loading={meetings.isLoading} error={meetings.error} />
        {meetings.data && upcoming.length === 0 && (
          <Empty icon={<CalendarDays />} title="No upcoming meetings">
            Schedule one from the <Link href="/calendar" className="font-medium text-accent-ink hover:underline">Calendar</Link>.
          </Empty>
        )}
        {upcoming.length > 0 && (
          <ul className="flex flex-col gap-2">
            {upcoming.slice(0, SHOWN).map((m) => (
              <MeetingRow key={m.id} meeting={m} showDate onOpen={() => setOpened(m)} />
            ))}
          </ul>
        )}
        {upcoming.length > SHOWN && (
          <Link href="/calendar" className="mt-2 block text-center text-xs text-ink-3 hover:text-ink">
            +{upcoming.length - SHOWN} more on the calendar
          </Link>
        )}
      </div>
      {opened && (
        <MeetingDetails
          meeting={opened}
          onClose={() => setOpened(null)}
          onEdit={() => {
            setEditing(opened);
            setOpened(null);
          }}
        />
      )}
      {editing && <MeetingForm meeting={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}
