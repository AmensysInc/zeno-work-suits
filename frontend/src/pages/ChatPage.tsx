import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCurrentProject } from '../components/layout/AppShell';
import { Button } from '../components/ui/button';
import { State } from '../components/ui/shared';
import { useData, useMe, useProjects } from '../hooks/data';
import { api, errorMessage } from '../services/api';
import type { ChatMessage, Project } from '../types';

const fullName = (user: { first_name: string; last_name: string }) =>
  `${user.first_name} ${user.last_name}`.trim();

const initials = (user: { first_name: string; last_name: string }) =>
  `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase();

const time = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

function ProjectList({
  projects,
  active,
}: {
  projects: Project[];
  active?: number;
}) {
  const [search, setSearch] = useState('');
  const visible = projects.filter((project) =>
    `${project.name} ${project.key}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <aside className="chat-list">
      <div className="chat-list-head">
        <h2>Project Chats</h2>
        <input
          type="search"
          aria-label="Search project chats"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <nav aria-label="Project chats">
        {visible.map((project) => (
          <Link
            key={project.id}
            className={project.id === active ? 'selected' : ''}
            to={`/chat?project=${project.id}`}
          >
            <span className="chat-dot" />
            <span>{project.name}</span>
          </Link>
        ))}
        {visible.length === 0 && <p className="muted">No projects found.</p>}
      </nav>
    </aside>
  );
}

export default function ChatPage() {
  const projects = useProjects();
  const me = useMe();
  const currentProject = useCurrentProject();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [membersOpen, setMembersOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const projectId =
    Number(params.get('project')) || currentProject || projects.data?.[0]?.id;
  const project = projects.data?.find((p) => p.id === projectId);
  const messages = useData<ChatMessage[]>(
    `/projects/${projectId}/chat`,
    !!projectId,
  );
  const send = useMutation({
    mutationFn: async () =>
      (
        await api.post<ChatMessage>(`/projects/${projectId}/chat`, {
          body: body.trim(),
        })
      ).data,
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: [`/projects/${projectId}/chat`] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const online = useMemo(() => {
    if (!project) return 0;
    return Math.max(1, Math.min(project.team.length, 3));
  }, [project]);

  useEffect(() => {
    if (!params.get('project') && projectId) {
      nav(`/chat?project=${projectId}`, { replace: true });
    }
  }, [nav, params, projectId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.data?.length, projectId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || send.isPending) return;
    await send.mutateAsync();
  };

  if (!projectId) {
    return (
      <State
        loading={projects.isLoading}
        error={projects.error}
        empty={projects.data?.length === 0}
      />
    );
  }

  return (
    <div className="chat-page">
      <ProjectList projects={projects.data ?? []} active={projectId} />
      <section className="chat-thread card">
        <header className="chat-header">
          <div>
            <h1>{project?.name ?? 'Project chat'}</h1>
            <span className="muted">{online} online</span>
          </div>
          <div className="actions">
            <button
              type="button"
              className="pin-button"
              aria-label="Pinned messages"
              title="Pinned messages"
            >
              Pin
            </button>
            <Button
              variant="outline"
              onClick={() => setMembersOpen((open) => !open)}
            >
              Members
            </Button>
          </div>
        </header>
        <div className="chat-body">
          <State
            loading={messages.isLoading}
            error={messages.error}
            empty={messages.data?.length === 0}
          />
          {messages.data?.map((message) => {
            const mine = message.user_id === me.data?.id;
            return (
              <div
                className={`chat-message ${mine ? 'mine' : ''}`}
                key={message.id}
              >
                <span className="mini-avatar">{initials(message.user)}</span>
                <div>
                  <span className="chat-author">{fullName(message.user)}</span>
                  <div className="chat-bubble">
                    <p>{message.body}</p>
                    <small>{time(message.created_at)}</small>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <form className="chat-composer" onSubmit={submit}>
          <button type="button" aria-label="Attach file" title="Attach file">
            +
          </button>
          <input
            aria-label="Message"
            placeholder="Type a message... (use @name to mention)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button disabled={!body.trim() || send.isPending} type="submit">
            Send
          </Button>
        </form>
      </section>
      {membersOpen && project && (
        <aside className="chat-members card">
          <div className="section-head">
            <h2>Members</h2>
            <button
              type="button"
              aria-label="Close members"
              onClick={() => setMembersOpen(false)}
            >
              x
            </button>
          </div>
          {project.team.map((member) => (
            <div className="member-row" key={member.user.id}>
              <span className="mini-avatar">{initials(member.user)}</span>
              <div>
                <strong>{fullName(member.user)}</strong>
                <span className="muted">
                  {member.role.replaceAll('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}
