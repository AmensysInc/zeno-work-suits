'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PageBar, PageBody } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Card, Empty, State } from '@/components/ui/display';
import { MeetingDetails, MeetingForm, MeetingRow } from '@/components/calendar/meeting-ui';
import { api } from '@/lib/api';
import { addDays, dayLabel, monthGrid, onDay, sameDay, startOfDay, time } from '@/lib/meetings';
import { cn } from '@/lib/utils';
import type { Meeting } from '@/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_CHIPS = 3;

export default function CalendarPage() {
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const [opened, setOpened] = useState<Meeting | null>(null);
  const [editing, setEditing] = useState<Meeting | 'new' | null>(null);

  const days = useMemo(() => monthGrid(month), [month]);
  const start = days[0];
  const end = addDays(days[days.length - 1], 1);
  const path = `/meetings?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
  const meetings = useQuery<Meeting[]>({
    queryKey: [path],
    queryFn: async () => (await api.get<Meeting[]>(path)).data,
    refetchInterval: 60_000,
  });
  const all = meetings.data ?? [];
  const forDay = (d: Date) => all.filter((m) => onDay(m, d));
  const selectedMeetings = forDay(selected);

  const go = (offset: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  const goToday = () => {
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month);

  return (
    <>
      <PageBar
        crumbs={['Calendar']}
        actions={
          <Button variant="primary" size="sm" icon={<Plus />} onClick={() => setEditing('new')}>
            Schedule meeting
          </Button>
        }
      />
      <PageBody>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <h1 className="mr-auto text-[16px] font-semibold tracking-tight">{monthName}</h1>
              <Button size="sm" onClick={goToday}>
                Today
              </Button>
              <Button size="icon" variant="ghost" aria-label="Previous month" icon={<ChevronLeft />} onClick={() => go(-1)} />
              <Button size="icon" variant="ghost" aria-label="Next month" icon={<ChevronRight />} onClick={() => go(1)} />
            </div>
            <State loading={meetings.isLoading} error={meetings.error} />
            <div role="grid" aria-label={monthName} className="grid grid-cols-7">
              {WEEKDAYS.map((d) => (
                <div key={d} role="columnheader" className="border-b border-line px-2 py-1.5 text-center text-[11.5px] font-medium text-ink-3">
                  {d}
                </div>
              ))}
              {days.map((d, i) => {
                const items = forDay(d);
                const inMonth = d.getMonth() === month.getMonth();
                const isToday = sameDay(d, today);
                const isSelected = sameDay(d, selected);
                return (
                  <div
                    key={d.toISOString()}
                    role="gridcell"
                    tabIndex={0}
                    aria-selected={isSelected}
                    aria-label={`${dayLabel(d)}, ${items.length} meeting${items.length === 1 ? '' : 's'}`}
                    onClick={() => setSelected(d)}
                    onDoubleClick={() => {
                      setSelected(d);
                      setEditing('new');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(d);
                      }
                    }}
                    className={cn(
                      'flex min-h-[64px] cursor-pointer flex-col gap-1 border-b border-line p-1.5 outline-none hover:bg-hover focus-visible:shadow-[inset_0_0_0_2px_var(--ring)] sm:min-h-[104px]',
                      i % 7 !== 6 && 'border-r',
                      !inMonth && 'bg-subtle/60',
                      isSelected && 'bg-accent-soft hover:bg-accent-soft',
                    )}
                  >
                    <span
                      className={cn(
                        'tnum grid size-6 place-items-center self-end rounded-full text-[12px]',
                        isToday ? 'bg-accent font-semibold text-white' : inMonth ? 'text-ink' : 'text-ink-3',
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {/* Chips on wider screens, dots on phones. */}
                    <ul className="hidden flex-col gap-0.5 sm:flex">
                      {items.slice(0, MAX_CHIPS).map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(d);
                              setOpened(m);
                            }}
                            className="flex w-full items-center gap-1 truncate rounded bg-accent/10 px-1.5 py-0.5 text-left text-[11.5px] text-accent-ink hover:bg-accent/20"
                          >
                            <span className="tnum shrink-0 opacity-80">{time(m.starts_at)}</span>
                            <span className="truncate font-medium">{m.title}</span>
                          </button>
                        </li>
                      ))}
                      {items.length > MAX_CHIPS && <li className="px-1.5 text-[11px] text-ink-3">+{items.length - MAX_CHIPS} more</li>}
                    </ul>
                    {items.length > 0 && (
                      <span className="flex justify-center gap-0.5 sm:hidden" aria-hidden>
                        {items.slice(0, 3).map((m) => (
                          <span key={m.id} className="size-1.5 rounded-full bg-accent" />
                        ))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="flex flex-col self-start">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13.5px] font-semibold">{sameDay(selected, today) ? 'Today' : dayLabel(selected)}</span>
                <span className="text-xs text-ink-3">
                  {selectedMeetings.length} meeting{selectedMeetings.length === 1 ? '' : 's'}
                </span>
              </div>
              <Button size="sm" icon={<Plus />} onClick={() => setEditing('new')}>
                New
              </Button>
            </div>
            <div className="p-3">
              {selectedMeetings.length === 0 ? (
                <Empty icon={<CalendarDays />} title="No meetings">
                  Nothing scheduled. Press New to invite people.
                </Empty>
              ) : (
                <ul className="flex flex-col gap-2">
                  {selectedMeetings.map((m) => (
                    <MeetingRow key={m.id} meeting={m} onOpen={() => setOpened(m)} />
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </PageBody>

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
      {editing && (
        <MeetingForm
          meeting={editing === 'new' ? undefined : editing}
          day={editing === 'new' ? selected : undefined}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            const d = startOfDay(new Date(m.starts_at));
            setSelected(d);
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
          }}
        />
      )}
    </>
  );
}
