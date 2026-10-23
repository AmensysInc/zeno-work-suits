import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Avatar,
  Badge as Dot,
  Drawer,
  Empty,
  Input,
  List,
  Typography,
} from 'antd';
import {
  PaperClipOutlined,
  PushpinOutlined,
  SendOutlined,
  TeamOutlined,
} from '@ant-design/icons';
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
        <Typography.Title level={5}>Project chats</Typography.Title>
        <Input.Search
          allowClear
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
            <Avatar shape="square" size={28} className="project-icon">
              {project.key.slice(0, 2)}
            </Avatar>
            <span>{project.name}</span>
          </Link>
        ))}
        {visible.length === 0 && (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No projects found."
          />
        )}
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
      <section className="chat-thread">
        <header className="chat-header">
          <div>
            <Typography.Title level={4}>
              {project?.name ?? 'Project chat'}
            </Typography.Title>
            <Dot status="success" text={`${online} online`} />
          </div>
          <div className="actions">
            <Button
              variant="ghost"
              icon={<PushpinOutlined />}
              aria-label="Pinned messages"
              title="Pinned messages"
            />
            <Button
              variant="outline"
              icon={<TeamOutlined />}
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
                <Avatar size={32} className="profile-avatar">
                  {initials(message.user)}
                </Avatar>
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
          <Button
            variant="ghost"
            icon={<PaperClipOutlined />}
            aria-label="Attach file"
            title="Attach file"
          />
          <Input
            aria-label="Message"
            size="large"
            placeholder="Type a message... (use @name to mention)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Button
            disabled={!body.trim()}
            loading={send.isPending}
            icon={<SendOutlined />}
            type="submit"
          >
            Send
          </Button>
        </form>
      </section>
      <Drawer
        title="Members"
        open={membersOpen && !!project}
        onClose={() => setMembersOpen(false)}
        size={320}
      >
        <List
          dataSource={project?.team ?? []}
          rowKey={(member) => member.user.id}
          renderItem={(member) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Avatar className="profile-avatar">
                    {initials(member.user)}
                  </Avatar>
                }
                title={fullName(member.user)}
                description={member.role.replaceAll('_', ' ')}
              />
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  );
}
