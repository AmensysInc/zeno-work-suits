import type { Meeting, Person } from '@/types';

const DAY = 864e5;
/** Join opens this long before a meeting starts. */
export const JOIN_EARLY_MS = 15 * 60 * 1000;

export const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`.trim();

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** The 6 weeks (Monday first) shown for the month containing `month`. */
export function monthGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** YYYY-MM-DD in local time, for <input type="date">. */
export const dateValue = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** HH:MM in local time, for <input type="time">. */
export const timeValue = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** A local date + time from the form, as a Date (the browser's time zone). */
export function combine(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export const time = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

export const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(d);

export const range = (m: Meeting) => `${time(m.starts_at)} – ${time(m.ends_at)}`;

/** Whether the meeting is on a given local day (it may span midnight). */
export function onDay(m: Meeting, day: Date) {
  const start = startOfDay(day).getTime();
  return new Date(m.starts_at).getTime() < start + DAY && new Date(m.ends_at).getTime() > start;
}

/** Join is offered from 15 minutes before the start until the end. */
export function joinable(m: Meeting, now = Date.now()) {
  return now >= new Date(m.starts_at).getTime() - JOIN_EARLY_MS && now < new Date(m.ends_at).getTime();
}

export const everyone = (m: Meeting): Person[] => [m.organizer, ...m.attendees];

/** The next half hour from now, for a new meeting's default start. */
export function nextSlot(day?: Date) {
  const now = new Date();
  const base = day && !sameDay(day, now) ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0) : now;
  if (base === now) {
    base.setSeconds(0, 0);
    base.setMinutes(base.getMinutes() < 30 ? 30 : 60);
  }
  return base;
}
