'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, Search, Send, Users } from 'lucide-react';
import { useCurrentProject } from '@/components/layout/context';
import { PageBar } from '@/components/layout/page';
import { Avatar, AvatarStack, Empty, ProjectMark, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useData, useMe, useProjects } from '@/hooks/data';
import { api, errorMessage } from '@/lib/api';
import { label, type ChatMessage, type Project } from '@/types';
import { cn } from '@/lib/utils';

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
  const messages = useData<ChatMessage[]>(`/projects/${projectId}/chat`, !!projectId);
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
            <Button size="sm" icon={<Users />} aria-expanded={membersOpen} onClick={() => setMembersOpen((o) => !o)}>
              Members
            </Button>
          </header>
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
                    <div className={cn('flex max-w-[78%] gap-2.5', mine && 'flex-row-reverse self-end')}>
                      <Avatar user={m.user} size={30} />
                      <div className={cn('flex min-w-0 flex-col gap-1', mine && 'items-end')}>
                        <span className="text-xs text-ink-3">
                          <b className="font-semibold text-ink-2">{mine ? 'You' : fullName(m.user)}</b> · {time(m.created_at)}
                        </span>
                        <p className={cn('whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-[13px]', mine ? 'rounded-tr-sm bg-accent text-white' : 'rounded-tl-sm border border-line bg-surface')}>{m.body}</p>
                      </div>
                    </div>
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
