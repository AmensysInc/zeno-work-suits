import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** "Oct 26" for this year, "Oct 26, 2025" otherwise. */
export function shortDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }),
  });
}

/** "12m", "3h", "2d" or a date for older items. */
export function ago(value?: string | null) {
  if (!value) return '';
  const s = (Date.now() - new Date(value).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return shortDate(value);
}

export const initials = (u?: { first_name: string; last_name: string } | null) =>
  u ? `${u.first_name[0] ?? ''}${u.last_name[0] ?? ''}`.toUpperCase() : '';
