'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, PhoneCall, Search, Send, Users, Video } from 'lucide-react';
import { useCurrentProject } from '@/components/layout/context';
import { useCall } from '@/components/chat/call-context';
import { PageBar } from '@/components/layout/page';
import { Avatar, AvatarStack, Empty, ProjectMark, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMe, useProjects } from '@/hooks/data';
import { api, errorMessage } from '@/lib/api';
import { label, type ChatMessage, type Project } from '@/types';
import { cn } from '@/lib/utils';

/** Polling keeps the chat and the "call in progress" banner current without a reload. */
const REFRESH_MS = 10_000;
/** Posted by the server when the first person joins a project call. */
const CALL_STARTED = '📞 started a video call';

type CallStatus = {
  enabled: boolean;
  active: boolean;
  participants: { identity: string; name: string; user_id: number | null }[];
};

const fullName = (user: { first_name: string; last_name: string }) => `${user.first_name} ${user.last_name}`.trim();
const time = (value: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const day = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(value));

function ProjectList({ projects, active }: { projects: Project[]; active?: number }) {
  const [search, setSearch] = useState('');
  const visible = projects.filter((p) => `${p.name} ${p.key}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-subtle md:flex">
      <div className="flex flex-col gap-2 p-3">
        <span className="caps px-1">Project chats</span>
        <Input size="sm" icon={<Search />} aria-label="Search project chats" placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <nav aria-label="Project chats" className="scrollbar-thin flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
        {visible.map((p) => (
          <Link
            key={p.id}
            href={`/chat?project=${p.id}`}
            aria-current={p.id === active ? 'page' : undefined}
            className={cn('flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-ink-2 hover:bg-hover', p.id === active && 'bg-sel font-medium text-ink')}
          >
            <ProjectMark project={p} size={22} />
            <span className="truncate">{p.name}</span>
          </Link>
        ))}
        {visible.length === 0 && <p className="px-2 py-4 text-center text-xs text-ink-3">No projects found.</p>}
      </nav>
    </aside>
  );
}

export default function ChatPage() {
  const projects = useProjects();
  const me = useMe();
  const currentProject = useCurrentProject();
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [membersOpen, setMembersOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const projectId = Number(params.get('project')) || currentProject || projects.data?.[0]?.id;
  const project = projects.data?.find((p) => p.id === projectId);
  const calls = useCall();
  const messages = useQuery<ChatMessage[]>({
    queryKey: [`/projects/${projectId}/chat`],
    queryFn: async () => (await api.get<ChatMessage[]>(`/projects/${projectId}/chat`)).data,
    enabled: !!projectId,
    refetchInterval: REFRESH_MS,
  });
  const call = useQuery<CallStatus>({
    queryKey: [`/projects/${projectId}/call`],
    queryFn: async () => (await api.get<CallStatus>(`/projects/${projectId}/call`)).data,
    enabled: !!projectId,
    refetchInterval: REFRESH_MS,
    retry: false,
  });
  const callActive = !!call.data?.active;
  const callPeople = call.data?.participants ?? [];
  // Already in (or minimized from) this project's call: the buttons bring it back.
  const inThisCall = calls.call?.projectId === projectId;
  const openCall = () => project && calls.open({ projectId: project.id, title: project.name });
  const send = useMutation({
    mutationFn: async () => (await api.post<ChatMessage>(`/projects/${projectId}/chat`, { body: body.trim() })).data,
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: [`/projects/${projectId}/chat`] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  useEffect(() => {
    if (!params.get('project') && projectId) router.replace(`/chat?project=${projectId}`);
  }, [router, params, projectId]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.data?.length, projectId]);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || send.isPending) return;
    try {
      await send.mutateAsync();
    } catch {
      /* toast */
    }
  };
  if (!projectId)
    return (
      <>
        <PageBar crumbs={['Chats']} />
        <State loading={projects.isLoading} error={projects.error} empty={projects.data?.length === 0} />
      </>
    );
  let lastDay = '';
  return (
    <>
      <PageBar crumbs={['Chats', project?.name ?? 'Project chat']} />
      <div className="flex min-h-0 flex-1">
        <ProjectList projects={projects.data ?? []} active={projectId} />
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
            {project && <ProjectMark project={project} size={28} />}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14px] font-semibold">{project?.name ?? 'Project chat'}</span>
              <span className="text-xs text-ink-3">{project?.team.length ?? 0} members</span>
            </div>
            {project && (
              <span className="hidden sm:inline-flex">
                <AvatarStack users={project.team.map((m) => m.user)} size={24} />
              </span>
            )}
            {call.data?.enabled && (
              <Button size="sm" variant={callActive || inThisCall ? 'success' : 'secondary'} icon={<Video />} onClick={openCall}>
                {inThisCall ? 'Return to call' : callActive ? 'Join call' : 'Call'}
              </Button>
            )}
            <Button size="sm" icon={<Users />} aria-expanded={membersOpen} onClick={() => setMembersOpen((o) => !o)}>
              Members
            </Button>
          </header>
          {callActive && (
            <div role="status" className="flex shrink-0 items-center gap-3 border-b border-green-200 bg-green-50 px-4 py-2 text-[13px] text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-300">
              <PhoneCall className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                <b className="font-semibold">Call in progress</b> · {callPeople.map((p) => p.name).join(', ')}
              </span>
              <Button size="sm" variant="success" onClick={openCall}>
                {inThisCall ? 'Return to call' : 'Join'}
              </Button>
            </div>
          )}
          <div className="flex min-h-0 flex-1">
            <div className="scrollbar-thin flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              <State loading={messages.isLoading} error={messages.error} />
              {messages.data?.length === 0 && (
                <Empty icon={<MessageSquare />} title="No messages yet">
                  Start the conversation for {project?.name ?? 'this project'}.
                </Empty>
              )}
              {messages.data?.map((m) => {
                const mine = m.user_id === me.data?.id;
                const d = day(m.created_at);
                const divider = d !== lastDay;
                lastDay = d;
                return (
                  <div key={m.id} className="flex flex-col gap-3">
                    {divider && (
                      <div className="flex items-center gap-3 text-[11.5px] font-medium text-ink-3">
                        <span className="h-px flex-1 bg-line" />
                        {d}
                        <span className="h-px flex-1 bg-line" />
                      </div>
                    )}
                    {m.body === CALL_STARTED ? (
                      <div className="flex items-center justify-center gap-2 text-[12.5px] text-ink-3">
                        <PhoneCall className="size-3.5" />
                        <span>
                          <b className="font-semibold text-ink-2">{mine ? 'You' : fullName(m.user)}</b> started a video call · {time(m.created_at)}
                        </span>
                      </div>
                    ) : (
                    <div className={cn('flex max-w-[78%] gap-2.5', mine && 'flex-row-reverse self-end')}>
                      <Avatar user={m.user} size={30} />
                      <div className={cn('flex min-w-0 flex-col gap-1', mine && 'items-end')}>
                        <span className="text-xs text-ink-3">
                          <b className="font-semibold text-ink-2">{mine ? 'You' : fullName(m.user)}</b> · {time(m.created_at)}
                        </span>
                        <p className={cn('whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-[13px]', mine ? 'rounded-tr-sm bg-accent text-white' : 'rounded-tl-sm border border-line bg-surface')}>{m.body}</p>
                      </div>
                    </div>
                    )}
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            {membersOpen && project && (
              <aside className="scrollbar-thin w-[260px] shrink-0 overflow-y-auto border-l border-line bg-subtle p-3 max-sm:absolute max-sm:inset-y-0 max-sm:right-0 max-sm:z-20 max-sm:shadow-lg">
                <span className="caps px-1">Members · {project.team.length}</span>
                <ul className="mt-2 flex flex-col gap-0.5">
                  {project.team.map((m) => (
                    <li key={m.user.id} className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
                      <Avatar user={m.user} size={28} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[13px] font-medium">{fullName(m.user)}</span>
                        <span className="text-xs text-ink-3">{label(m.role)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
          <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-3">
            <Input size="lg" aria-label="Message" className="flex-1" placeholder={`Message ${project?.name ?? 'the team'}…`} value={body} onChange={(e) => setBody(e.target.value)} />
            <Button type="submit" variant="primary" size="lg" disabled={!body.trim()} loading={send.isPending} icon={<Send />}>
              Send
            </Button>
          </form>
        </section>
      </div>
    </>
  );
}
