'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bell,
  BellOff,
  BellRing,
  CalendarDays,
  CalendarX,
  CheckCheck,
  CircleDot,
  MessageSquare,
  MessagesSquare,
  PenLine,
  UserMinus,
  UserPlus,
  Video,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ago, cn } from '@/lib/utils';
import type { AppNotification, NotificationList } from '@/types';
import { Popover } from '@/components/ui/controls';

/** How often the bell checks for news; it keeps checking in a background tab. */
const POLL_MS = 15_000;
const PATH = '/notifications';

const ICONS: Record<string, ReactNode> = {
  issue_assigned: <UserPlus />,
  issue_unassigned: <UserMinus />,
  issue_status: <CircleDot />,
  issue_updated: <PenLine />,
  comment: <MessageSquare />,
  chat: <MessagesSquare />,
  call: <Video />,
  meeting_invite: <CalendarDays />,
  meeting_updated: <CalendarDays />,
  meeting_cancelled: <CalendarX />,
};

type Permission = NotificationPermission | 'unsupported';

const browserPermission = (): Permission =>
  typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';

type Feed = {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  permission: Permission;
  enableDesktop: () => void;
  open: (n: AppNotification) => void;
  markAllRead: () => void;
};

const FeedContext = createContext<Feed | null>(null);

/**
 * Polls the person's notifications once for the whole app. Anything new since
 * the page loaded pops up: as a Chrome (desktop) notification when this window
 * is not in front, otherwise as a toast in the corner.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [permission, setPermission] = useState<Permission>('unsupported');
  const seen = useRef<number | null>(null);
  const feed = useQuery<NotificationList>({
    queryKey: [PATH],
    queryFn: async () => (await api.get<NotificationList>(PATH)).data,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  useEffect(() => setPermission(browserPermission()), []);

  const markRead = useCallback(
    async (body: { ids: number[] } | { all: true }) => {
      try {
        await api.post(`${PATH}/read`, body);
      } finally {
        qc.invalidateQueries({ queryKey: [PATH] });
      }
    },
    [qc],
  );

  const open = useCallback(
    (n: AppNotification) => {
      if (!n.read_at) void markRead({ ids: [n.id] });
      if (n.link) router.push(n.link);
    },
    [markRead, router],
  );

  // Announce what arrived since the last check (never the backlog on page load).
  useEffect(() => {
    const items = feed.data?.items;
    if (!items) return;
    const newest = items[0]?.id ?? 0;
    if (seen.current === null) {
      seen.current = newest;
      return;
    }
    const fresh = items.filter((n) => n.id > (seen.current ?? 0) && !n.read_at).reverse();
    seen.current = Math.max(seen.current, newest);
    if (!fresh.length) return;
    // Pages showing the same data (chat, issue, calendar) refresh straight away.
    qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== PATH });
    const inFront = document.visibilityState === 'visible' && document.hasFocus();
    for (const n of fresh.slice(-5)) {
      if (!inFront && browserPermission() === 'granted') {
        try {
          // The tag stops two open tabs from showing the same alert twice.
          const alert = new Notification(n.title, { body: n.body, tag: `zeno-${n.id}` });
          alert.onclick = () => {
            window.focus();
            open(n);
            alert.close();
          };
        } catch {
          /* some browsers only allow notifications from a service worker */
        }
      } else if (inFront) {
        toast(n.title, {
          description: n.body || undefined,
          action: n.link ? { label: 'Open', onClick: () => open(n) } : undefined,
        });
      }
    }
  }, [feed.data, open, qc]);

  const enableDesktop = useCallback(() => {
    if (browserPermission() === 'unsupported') return;
    void Notification.requestPermission().then((p) => {
      setPermission(p);
      if (p === 'granted') toast.success('Desktop notifications are on');
    });
  }, []);

  const value: Feed = {
    items: feed.data?.items ?? [],
    unread: feed.data?.unread ?? 0,
    loading: feed.isLoading,
    permission,
    enableDesktop,
    open,
    markAllRead: () => void markRead({ all: true }),
  };
  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
}

function DesktopPrompt({ feed }: { feed: Feed }) {
  if (feed.permission === 'granted' || feed.permission === 'unsupported') return null;
  if (feed.permission === 'denied') {
    return (
      <div className="mx-1 mb-1 flex items-start gap-2 rounded-md bg-hover px-2.5 py-2 text-[12px] text-ink-2">
        <BellOff className="mt-px size-3.5 shrink-0 text-ink-3" />
        <span>Desktop notifications are blocked. Allow them from the lock icon next to the address bar.</span>
      </div>
    );
  }
  return (
    <button
      onClick={feed.enableDesktop}
      className="mx-1 mb-1 flex w-[calc(100%-8px)] items-start gap-2 rounded-md bg-accent/10 px-2.5 py-2 text-left text-[12px] text-ink hover:bg-accent/15"
    >
      <BellRing className="mt-px size-3.5 shrink-0 text-accent" />
      <span>
        <span className="font-semibold">Turn on desktop notifications</span>
        <span className="block text-ink-2">Get a Chrome alert for new chats, calls and tickets while you work elsewhere.</span>
      </span>
    </button>
  );
}

/** The bell button with its unread count and the list that opens from it. */
export function NotificationBell({ align = 'start', className }: { align?: 'start' | 'end'; className?: string }) {
  const feed = useContext(FeedContext);
  const [open, setOpen] = useState(false);
  if (!feed) return null;
  const count = feed.unread > 99 ? '99+' : String(feed.unread);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align={align}
      className="w-[min(360px,calc(100vw-24px))] p-0"
      trigger={
        <button
          aria-label={feed.unread ? `Notifications, ${feed.unread} unread` : 'Notifications'}
          className={cn('relative flex size-7 items-center justify-center rounded-md text-ink-2 hover:bg-hover', className)}
        >
          <Bell className="size-[15px]" />
          {feed.unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
              {count}
            </span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <span className="text-[13px] font-semibold">Notifications</span>
        <button
          onClick={feed.markAllRead}
          disabled={!feed.unread}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] text-ink-2 hover:bg-hover disabled:opacity-40"
        >
          <CheckCheck className="size-3.5" />
          Mark all read
        </button>
      </div>
      <div className="pt-1">
        <DesktopPrompt feed={feed} />
      </div>
      <div className="scrollbar-thin max-h-[min(420px,60vh)] overflow-y-auto p-1">
        {feed.items.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              setOpen(false);
              feed.open(n);
            }}
            className={cn('flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-hover', !n.read_at && 'bg-accent/[0.06]')}
          >
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-hover text-ink-2 [&_svg]:size-3.5">
              {ICONS[n.kind] ?? <Bell />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('line-clamp-2 text-[12.5px]', n.read_at ? 'text-ink-2' : 'font-medium text-ink')}>{n.title}</span>
              {n.body && <span className="mt-0.5 line-clamp-2 block text-[12px] text-ink-3">{n.body}</span>}
              <span className="mt-0.5 block text-[11px] text-ink-3">{ago(n.created_at)}</span>
            </span>
            {!n.read_at && <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
          </button>
        ))}
        {!feed.items.length && (
          <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
            <Bell className="size-5 text-ink-3" />
            <span className="text-[12.5px] font-medium">You&apos;re all caught up</span>
            <span className="text-[11.5px] text-ink-3">New tickets, changes, chats, calls and meetings show up here.</span>
          </div>
        )}
      </div>
    </Popover>
  );
}
