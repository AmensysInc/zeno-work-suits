'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarClock, Check, Pencil, Search, Trash2, Users, Video, X } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Avatar, AvatarStack, Badge, ProjectMark } from '@/components/ui/display';
import { useCall, sameCall } from '@/components/chat/call-context';
import { useData, useMe, useProjects } from '@/hooks/data';
import { api, errorMessage } from '@/lib/api';
import {
  addDays,
  combine,
  dateValue,
  dayLabel,
  everyone,
  fullName,
  joinable,
  nextSlot,
  range,
  timeValue,
} from '@/lib/meetings';
import { cn } from '@/lib/utils';
import type { Meeting, Person } from '@/types';

/** Refreshes every calendar list and the Home card after a change. */
function useRefreshMeetings() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('/meetings') });
}

/** Organizers and admins may change or cancel a meeting. */
export function useCanEdit(meeting: Meeting) {
  const me = useMe();
  return !!me.data && (me.data.id === meeting.organizer.id || me.data.role === 'ADMIN');
}

/** Opens the meeting's own call (minimizable, like project calls). */
export function JoinButton({ meeting, size = 'sm' }: { meeting: Meeting; size?: 'sm' | 'md' }) {
  const calls = useCall();
  const inCall = sameCall(calls.call, { kind: 'meeting', id: meeting.id });
  const live = joinable(meeting);
  return (
    <Button
      size={size}
      variant={live || inCall ? 'success' : 'secondary'}
      icon={<Video />}
      onClick={(e) => {
        e.stopPropagation();
        calls.open({ kind: 'meeting', id: meeting.id, title: meeting.title });
      }}
    >
      {inCall ? 'Return to call' : 'Join'}
    </Button>
  );
}

/** One meeting in a list: time, title, project, people, and Join when it is near. */
export function MeetingRow({ meeting, onOpen, showDate = false }: { meeting: Meeting; onOpen: () => void; showDate?: boolean }) {
  const live = joinable(meeting);
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          'flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left outline-none hover:bg-hover focus-visible:shadow-[0_0_0_3px_var(--ring)]',
          live ? 'border-green-300 bg-green-50/60 dark:border-green-900/60 dark:bg-green-950/30' : 'border-line bg-surface',
        )}
      >
        <div className="flex w-[92px] shrink-0 flex-col text-[12px] leading-tight">
          {showDate && (
            <span className="font-medium text-ink-2">
              {new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(meeting.starts_at))}
            </span>
          )}
          <span className="tnum text-ink-3">{range(meeting)}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-[13px] font-semibold">{meeting.title}</span>
          <span className="flex items-center gap-2 text-[11.5px] text-ink-3">
            {meeting.project && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <ProjectMark project={meeting.project} size={14} />
                <span className="truncate">{meeting.project.name}</span>
              </span>
            )}
            <AvatarStack users={everyone(meeting)} size={18} max={4} />
          </span>
        </div>
        {live && <JoinButton meeting={meeting} />}
      </div>
    </li>
  );
}

/** Details of one meeting, with Join, Edit and Cancel meeting. */
export function MeetingDetails({ meeting, onClose, onEdit }: { meeting: Meeting; onClose: () => void; onEdit: () => void }) {
  const canEdit = useCanEdit(meeting);
  const refresh = useRefreshMeetings();
  const [confirm, setConfirm] = useState(false);
  const cancel = useMutation({
    mutationFn: async () => api.delete(`/meetings/${meeting.id}`),
    onSuccess: () => {
      refresh();
      toast.success('Meeting cancelled');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const start = new Date(meeting.starts_at);
  return (
    <Dialog
      onClose={onClose}
      title={meeting.title}
      description={`${dayLabel(start)} · ${range(meeting)}`}
      footer={
        <>
          {canEdit &&
            (confirm ? (
              <Button variant="danger" icon={<Trash2 />} loading={cancel.isPending} onClick={() => cancel.mutate()}>
                Yes, cancel meeting
              </Button>
            ) : (
              <Button variant="ghost" icon={<Trash2 />} onClick={() => setConfirm(true)}>
                Cancel meeting
              </Button>
            ))}
          <span className="flex-1" />
          {canEdit && (
            <Button icon={<Pencil />} onClick={onEdit}>
              Edit
            </Button>
          )}
          <JoinButton meeting={meeting} size="md" />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {meeting.project && (
          <span className="inline-flex items-center gap-2 text-[13px]">
            <ProjectMark project={meeting.project} size={18} />
            {meeting.project.name}
          </span>
        )}
        {meeting.description && <p className="whitespace-pre-wrap text-[13px] text-ink-2">{meeting.description}</p>}
        <div className="flex flex-col gap-2">
          <span className="caps">People · {everyone(meeting).length}</span>
          <ul className="flex flex-col gap-1">
            {everyone(meeting).map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 text-[13px]">
                <Avatar user={p} size={24} />
                <span className="flex-1">{fullName(p)}</span>
                {p.id === meeting.organizer.id && <Badge tone="indigo">Organizer</Badge>}
              </li>
            ))}
          </ul>
        </div>
        {!joinable(meeting) && (
          <p className="text-xs text-ink-3">Join is highlighted from 15 minutes before the start; you can open the call any time.</p>
        )}
      </div>
    </Dialog>
  );
}

/** Pick people from the whole company, with search; the organizer is always in. */
function PeoplePicker({ value, onChange, organizerId }: { value: number[]; onChange: (ids: number[]) => void; organizerId?: number }) {
  const people = useData<Person[]>('/meetings/people');
  const [search, setSearch] = useState('');
  const chosen = new Set(value);
  const others = (people.data ?? []).filter((p) => p.id !== organizerId);
  const shown = others.filter((p) => fullName(p).toLowerCase().includes(search.trim().toLowerCase()));
  const picked = others.filter((p) => chosen.has(p.id));
  const toggle = (id: number) => onChange(chosen.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-col gap-2">
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {picked.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-subtle py-0.5 pl-0.5 pr-1.5 text-[12px]">
              <Avatar user={p} size={18} />
              {fullName(p)}
              <button type="button" aria-label={`Remove ${fullName(p)}`} onClick={() => toggle(p.id)} className="text-ink-3 hover:text-ink">
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input size="sm" icon={<Search />} aria-label="Search people" placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ul className="scrollbar-thin max-h-48 overflow-y-auto rounded-md border border-line">
        {people.isLoading && <li className="px-3 py-2 text-xs text-ink-3">Loading people…</li>}
        {shown.map((p) => {
          const on = chosen.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(p.id)}
                className={cn('flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] hover:bg-hover', on && 'bg-sel')}
              >
                <Avatar user={p} size={22} />
                <span className="flex-1 truncate">{fullName(p)}</span>
                {on && <Check className="size-3.5 text-accent" />}
              </button>
            </li>
          );
        })}
        {people.data && shown.length === 0 && <li className="px-3 py-2 text-xs text-ink-3">No one matches “{search}”.</li>}
      </ul>
    </div>
  );
}

/** Schedule a new meeting, or edit one (organizer or admin). */
export function MeetingForm({ meeting, day, onClose, onSaved }: { meeting?: Meeting; day?: Date; onClose: () => void; onSaved?: (m: Meeting) => void }) {
  const me = useMe();
  const projects = useProjects();
  const refresh = useRefreshMeetings();
  const initial = useMemo(() => {
    const start = meeting ? new Date(meeting.starts_at) : nextSlot(day);
    const end = meeting ? new Date(meeting.ends_at) : new Date(start.getTime() + 30 * 60 * 1000);
    return { date: dateValue(start), start: timeValue(start), end: timeValue(end), endDate: dateValue(end) };
  }, [meeting, day]);
  const [title, setTitle] = useState(meeting?.title ?? '');
  const [description, setDescription] = useState(meeting?.description ?? '');
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.start);
  const [endTime, setEndTime] = useState(initial.end);
  const [projectId, setProjectId] = useState<number>(meeting?.project?.id ?? 0);
  const [attendees, setAttendees] = useState<number[]>(meeting?.attendees.map((p) => p.id) ?? []);

  const startsAt = date && startTime ? combine(date, startTime) : null;
  // An end time earlier than the start means the meeting runs past midnight.
  let endsAt = date && endTime ? combine(date, endTime) : null;
  if (startsAt && endsAt && endsAt <= startsAt) endsAt = addDays(endsAt, 1);
  const minutes = startsAt && endsAt ? Math.round((endsAt.getTime() - startsAt.getTime()) / 60000) : 0;
  const problem = !title.trim()
    ? 'Give the meeting a title.'
    : !startsAt || !endsAt
      ? 'Choose a date, start and end time.'
      : minutes > 12 * 60
        ? 'A meeting can be at most 12 hours long.'
        : null;

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        title: title.trim(),
        description,
        starts_at: startsAt!.toISOString(),
        ends_at: endsAt!.toISOString(),
        project_id: projectId || null,
        attendee_ids: attendees,
      };
      return (meeting ? await api.put<Meeting>(`/meetings/${meeting.id}`, body) : await api.post<Meeting>('/meetings', body)).data;
    },
    onSuccess: (saved) => {
      refresh();
      toast.success(meeting ? 'Meeting updated' : 'Meeting scheduled');
      onSaved?.(saved);
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const organizerId = meeting?.organizer.id ?? me.data?.id;
  return (
    <Dialog
      onClose={onClose}
      title={meeting ? 'Edit meeting' : 'Schedule a meeting'}
      description="Invited people see it on their Calendar and Home page, with a Join button for its video call."
      width={600}
      footer={
        <>
          {/* A missing title is obvious from the empty box; time problems are not. */}
          <span className="flex-1 text-xs text-red-600">{title.trim() ? problem : ''}</span>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" icon={<CalendarClock />} disabled={!!problem} loading={save.isPending} onClick={() => save.mutate()}>
            {meeting ? 'Save changes' : 'Schedule'}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!problem) save.mutate();
        }}
      >
        <Field label="Title">{(id) => <Input id={id} size="lg" autoFocus maxLength={200} placeholder="e.g. Sprint review" value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <Field label="Date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
          <Field label="Start">{(id) => <Input id={id} type="time" step={300} value={startTime} onChange={(e) => setStartTime(e.target.value)} />}</Field>
          <Field label="End" hint={minutes > 0 ? `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h ` : ''}${minutes % 60 ? `${minutes % 60} min` : ''}` : undefined}>
            {(id) => <Input id={id} type="time" step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} />}
          </Field>
        </div>
        <Field label={<span className="inline-flex items-center gap-1.5"><Users className="size-3.5" /> Invite people</span>} hint="Anyone in the company. You are included as the organizer.">
          {() => <PeoplePicker value={attendees} onChange={setAttendees} organizerId={organizerId} />}
        </Field>
        <Field label="Project" optional>
          {(id) => (
            <Select<number>
              id={id}
              value={projectId}
              onChange={setProjectId}
              options={[
                { value: 0, label: 'No project' },
                ...(projects.data ?? []).map((p) => ({ value: p.id, label: p.name, icon: <ProjectMark project={p} size={16} /> })),
              ]}
            />
          )}
        </Field>
        <Field label="Agenda" optional>
          {(id) => <Textarea id={id} rows={3} maxLength={5000} placeholder="What will you cover?" value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
      </form>
    </Dialog>
  );
}
