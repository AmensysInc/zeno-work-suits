'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, Copy, Download, FileText, MessageSquare, Send, Trash2 } from 'lucide-react';
import { Avatar, Empty } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMe } from '@/hooks/data';
import { api, errorMessage } from '@/lib/api';
import { fullName } from '@/lib/meetings';
import { languageName } from '@/lib/soniox-live';
import { cn } from '@/lib/utils';
import type { CallTranscript, Meeting, MeetingMessage } from '@/types';

const REFRESH_MS = 10_000;
const time = (value: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const when = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

function minutes(t: CallTranscript) {
  const end = new Date(t.ended_at ?? t.updated_at).getTime();
  const m = Math.max(1, Math.round((end - new Date(t.started_at).getTime()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/** A call transcript in a chat: who recorded it, length, languages, and the text. */
export function TranscriptCard({ transcript, title, canDelete, onDeleted }: { transcript: CallTranscript; title: string; canDelete?: boolean; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const recording = transcript.status === 'RECORDING';
  const text = transcript.text.trim();
  const download = () => {
    const blob = new Blob([`${title}\n${when(transcript.started_at)} · ${minutes(transcript)}\n\n${text}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^\w\- ]+/g, '').trim() || 'call'} transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const remove = async () => {
    try {
      await api.delete(`/calls/transcripts/${transcript.id}`);
      onDeleted?.();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <div className="mx-auto w-full max-w-[640px] rounded-xl border border-line bg-subtle">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
          <FileText className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-semibold">
            {recording ? 'Recording in progress…' : 'Call transcript'}
            {transcript.status === 'INTERRUPTED' && <span className="ml-1.5 font-normal text-amber-600">(recording was cut off)</span>}
          </span>
          <span className="truncate text-[11.5px] text-ink-3">
            {fullName(transcript.user)} · {when(transcript.started_at)} · {minutes(transcript)}
            {transcript.languages.length > 0 && ` · ${transcript.languages.map(languageName).join(', ')}`}
          </span>
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-ink-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line px-3 pb-3 pt-2">
          {text ? (
            <p className="scrollbar-thin max-h-[320px] overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{text}</p>
          ) : (
            <p className="text-[12.5px] text-ink-3">{recording ? 'Words appear here as the recording is saved.' : 'Nothing was said while recording.'}</p>
          )}
          {text && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" icon={<Copy />} onClick={() => navigator.clipboard.writeText(text).then(() => toast.success('Copied'), () => toast.error('Copy failed'))}>
                Copy
              </Button>
              <Button size="sm" icon={<Download />} onClick={download}>
                Download .txt
              </Button>
              {canDelete && !recording && (
                <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void remove()}>
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Item = { kind: 'message'; at: string; message: MeetingMessage } | { kind: 'transcript'; at: string; transcript: CallTranscript };

/** The meeting's own chat: messages, plus the transcripts of its recorded calls. */
export function MeetingChat({ meeting }: { meeting: Meeting }) {
  const me = useMe();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const messagesPath = `/meetings/${meeting.id}/messages`;
  const transcriptsPath = `/meetings/${meeting.id}/transcripts`;
  const messages = useQuery<MeetingMessage[]>({
    queryKey: [messagesPath],
    queryFn: async () => (await api.get<MeetingMessage[]>(messagesPath)).data,
    refetchInterval: REFRESH_MS,
  });
  const transcripts = useQuery<CallTranscript[]>({
    queryKey: [transcriptsPath],
    queryFn: async () => (await api.get<CallTranscript[]>(transcriptsPath)).data,
    refetchInterval: REFRESH_MS,
  });
  const send = useMutation({
    mutationFn: async () => (await api.post<MeetingMessage>(messagesPath, { body: body.trim() })).data,
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: [messagesPath] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const items: Item[] = [
    ...(messages.data ?? []).map((m) => ({ kind: 'message' as const, at: m.created_at, message: m })),
    ...(transcripts.data ?? []).map((t) => ({ kind: 'transcript' as const, at: t.started_at, transcript: t })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const isOrganizer = me.data && (me.data.id === meeting.organizer.id || me.data.role === 'ADMIN');

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [items.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (body.trim() && !send.isPending) send.mutate();
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="scrollbar-thin flex max-h-[min(420px,50vh)] min-h-[160px] flex-col gap-3 overflow-y-auto rounded-lg border border-line bg-surface p-3">
        {items.length === 0 && !messages.isLoading && (
          <Empty icon={<MessageSquare />} title="No messages yet">
            Talk before or after the meeting. Recorded call transcripts appear here too.
          </Empty>
        )}
        {items.map((item) => {
          if (item.kind === 'transcript') {
            const t = item.transcript;
            return (
              <TranscriptCard
                key={`t${t.id}`}
                transcript={t}
                title={meeting.title}
                canDelete={!!isOrganizer || t.user.id === me.data?.id}
                onDeleted={() => qc.invalidateQueries({ queryKey: [transcriptsPath] })}
              />
            );
          }
          const m = item.message;
          const mine = m.user.id === me.data?.id;
          return (
            <div key={`m${m.id}`} className={cn('flex max-w-[85%] gap-2', mine && 'flex-row-reverse self-end')}>
              <Avatar user={m.user} size={26} />
              <div className={cn('flex min-w-0 flex-col gap-0.5', mine && 'items-end')}>
                <span className="text-[11.5px] text-ink-3">
                  <b className="font-semibold text-ink-2">{mine ? 'You' : fullName(m.user)}</b> · {time(m.created_at)}
                </span>
                <p className={cn('whitespace-pre-wrap break-words rounded-xl px-3 py-1.5 text-[13px]', mine ? 'rounded-tr-sm bg-accent text-white' : 'rounded-tl-sm border border-line bg-subtle')}>
                  {m.body}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex items-center gap-2">
        <Input aria-label="Message" className="flex-1" maxLength={4000} placeholder="Message everyone in this meeting…" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button type="submit" variant="primary" disabled={!body.trim()} loading={send.isPending} icon={<Send />}>
          Send
        </Button>
      </form>
    </div>
  );
}
