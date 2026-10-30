'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Check,
  ChevronDown,
  Copy,
  FilePlus2,
  Languages,
  Mic,
  Plus,
  Save,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import {
  languageName,
  markedSegments,
  startLive,
  toText,
  type LiveToken,
} from '@/lib/soniox-live';
import { useData } from '@/hooks/data';
import type { VoiceTranscript } from '@/types';
import { PageBar, PageBody } from '@/components/layout/page';
import { useCreateIssue, useCurrentProject } from '@/components/layout/context';
import { Badge, Card, Empty, Note, State, Tag } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Popover, Switch } from '@/components/ui/controls';
import { confirm } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';

const LANGUAGE_OPTIONS = [
  'en',
  'hi',
  'te',
  'ta',
  'kn',
  'ml',
  'mr',
  'bn',
  'gu',
  'pa',
  'ur',
  'es',
  'fr',
  'de',
  'ar',
  'zh',
  'ja',
  'ko',
  'pt',
  'ru',
  'it',
  'nl',
  'tr',
  'id',
  'vi',
];
const DEFAULT_LANGUAGES = ['en', 'hi', 'te'];
const PREFS_KEY = 'zeno_stt_prefs';

const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${sec}`
    : `${String(m).padStart(2, '0')}:${sec}`;
};
const when = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function loadPrefs(): { languages: string[]; strict: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (saved && Array.isArray(saved.languages))
      return { languages: saved.languages, strict: saved.strict !== false };
  } catch {
    /* storage unavailable */
  }
  return { languages: DEFAULT_LANGUAGES, strict: true };
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  } catch {
    toast.error('Copy failed. Select the text and copy it manually.');
  }
}

function LanguagePicker({
  languages,
  strict,
  disabled,
  onChange,
}: {
  languages: string[];
  strict: boolean;
  disabled: boolean;
  onChange: (languages: string[], strict: boolean) => void;
}) {
  return (
    <Popover
      className="w-72 p-0"
      trigger={
        <Button disabled={disabled} icon={<Languages />}>
          <span className="max-w-[220px] truncate">
            {languages.length
              ? languages.map(languageName).join(', ')
              : 'Any language'}
          </span>
          <ChevronDown className="size-3.5 text-ink-3" />
        </Button>
      }
    >
      <div className="border-b border-line px-3 py-2.5 text-xs text-ink-2">
        Pick every language your team speaks. Switching between them
        mid-sentence is detected automatically.
      </div>
      <div className="scrollbar-thin grid max-h-64 grid-cols-2 gap-0.5 overflow-y-auto p-1.5">
        {LANGUAGE_OPTIONS.map((code) => {
          const on = languages.includes(code);
          return (
            <button
              key={code}
              role="checkbox"
              aria-checked={on}
              onClick={() =>
                onChange(
                  on
                    ? languages.filter((l) => l !== code)
                    : [...languages, code],
                  strict,
                )
              }
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover',
                on && 'bg-accent-soft text-accent-ink hover:bg-accent-soft',
              )}
            >
              <span
                className={cn(
                  'flex size-3.5 items-center justify-center rounded-[4px] border border-line-2',
                  on && 'border-accent bg-accent text-white',
                )}
              >
                {on && <Check className="size-2.5" strokeWidth={3} />}
              </span>
              {languageName(code)}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-1 border-t border-line px-3 py-2.5">
        <Switch
          checked={strict}
          onChange={(s) => onChange(languages, s)}
          label="Only these languages"
        />
        <span className="text-[11.5px] text-ink-3">
          Keeps words from coming out in the wrong script. Turn off for meetings
          in other languages.
        </span>
      </div>
    </Popover>
  );
}

function LiveView({
  base,
  final,
  pending,
}: {
  base: string;
  final: LiveToken[];
  pending: LiveToken[];
}) {
  const end = useRef<HTMLDivElement>(null);
  const parts = useMemo(() => markedSegments(final, pending), [final, pending]);
  useEffect(() => {
    // Recent browsers return a Promise from scrollIntoView; effects must not.
    end.current?.scrollIntoView({ block: 'end' });
  }, [parts]);
  return (
    <div
      className="scrollbar-thin h-[300px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-surface px-3.5 py-3 text-[14px] leading-relaxed"
      aria-live="polite"
    >
      {base && (
        <span className="text-ink-2">
          {base}
          {'\n\n'}
        </span>
      )}
      {!parts.length && (
        <span className="text-ink-3">Listening… start speaking.</span>
      )}
      {parts.map((p, i) => (
        <span key={i}>
          {p.newSpeaker && (
            <span className="mt-2 block text-[11.5px] font-semibold uppercase tracking-wide text-accent-ink">
              Speaker {p.speaker}
            </span>
          )}
          {p.newLanguage && (
            <span
              className="mx-1 inline-block rounded bg-hover px-1 align-middle font-mono text-[10.5px] font-medium uppercase text-ink-3"
              title={languageName(p.language!)}
            >
              {p.language}
            </span>
          )}
          <span className={p.final ? '' : 'text-ink-3'}>
            {p.newSpeaker ? p.text.trimStart() : p.text}
          </span>
        </span>
      ))}
      <div ref={end} />
    </div>
  );
}

function TranscriptDialog({
  transcript,
  onClose,
}: {
  transcript: VoiceTranscript;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const create = useCreateIssue();
  const [title, setTitle] = useState(transcript.title);
  const [text, setText] = useState(transcript.text);
  const [busy, setBusy] = useState(false);
  const changed = title !== transcript.title || text !== transcript.text;
  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await work();
      await qc.invalidateQueries({ queryKey: ['/voice/transcripts'] });
      toast.success(done);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      width={760}
      title={transcript.title}
      description={`${when(transcript.created_at)} · ${clock(transcript.duration_seconds)}${transcript.project ? ` · ${transcript.project.name}` : ''}`}
      onClose={onClose}
      footer={
        <>
          <Button
            variant="ghost"
            icon={<Trash2 />}
            className="mr-auto"
            disabled={busy}
            onClick={async () => {
              if (
                await confirm(
                  `Delete "${transcript.title}"? This cannot be undone.`,
                  { okText: 'Delete' },
                )
              )
                await run(
                  () => api.delete(`/voice/transcripts/${transcript.id}`),
                  'Transcript deleted',
                );
            }}
          >
            Delete
          </Button>
          <Button icon={<Copy />} onClick={() => copy(text)}>
            Copy
          </Button>
          <Button
            icon={<FilePlus2 />}
            onClick={() => {
              create({
                project_id: transcript.project?.id,
                summary: title.slice(0, 120),
                description: text,
              });
              onClose();
            }}
          >
            Create issue
          </Button>
          <Button
            variant="primary"
            icon={<Save />}
            disabled={!changed || !title.trim() || !text.trim()}
            loading={busy}
            onClick={() =>
              run(
                () =>
                  api.put(`/voice/transcripts/${transcript.id}`, {
                    title,
                    text,
                  }),
                'Transcript updated',
              )
            }
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Input
          aria-label="Title"
          size="lg"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
        {transcript.languages.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {transcript.languages.map((l) => (
              <Tag key={l}>{languageName(l)}</Tag>
            ))}
          </div>
        )}
        <Textarea
          aria-label="Transcript"
          rows={16}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-[14px] leading-relaxed"
        />
      </div>
    </Dialog>
  );
}

export default function SpeechToTextPage() {
  const qc = useQueryClient();
  const create = useCreateIssue();
  const currentProject = useCurrentProject();
  const transcripts = useData<VoiceTranscript[]>('/voice/transcripts');
  const [prefs, setPrefs] = useState<{ languages: string[]; strict: boolean }>({
    languages: DEFAULT_LANGUAGES,
    strict: true,
  });
  const [phase, setPhase] = useState<'idle' | 'starting' | 'live' | 'stopping'>(
    'idle',
  );
  const [final, setFinal] = useState<LiveToken[]>([]);
  const [pending, setPending] = useState<LiveToken[]>([]);
  const [base, setBase] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [heard, setHeard] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<VoiceTranscript | null>(null);
  const live = useRef<{ stop: () => void } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const finalRef = useRef<LiveToken[]>([]);
  const baseRef = useRef('');

  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);
  useEffect(
    () => () => {
      window.clearInterval(timer.current);
      live.current?.stop();
    },
    [],
  );
  // Warn before leaving with an unsaved transcript.
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty || phase === 'live') e.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, phase]);

  const updatePrefs = (languages: string[], strict: boolean) => {
    setPrefs({ languages, strict });
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ languages, strict }));
    } catch {
      /* storage unavailable */
    }
  };

  const recording = phase !== 'idle';

  async function start() {
    setError('');
    setPhase('starting');
    // Recording again continues the same transcript.
    baseRef.current = text.trim();
    setBase(baseRef.current);
    finalRef.current = [];
    setFinal([]);
    setPending([]);
    try {
      live.current = await startLive({
        languages: prefs.languages,
        strict: prefs.strict,
        onTokens: (f, p) => {
          finalRef.current = f;
          setFinal(f);
          setPending(p);
        },
        onError: (message) => setError(message),
        onEnd: () => {
          window.clearInterval(timer.current);
          live.current = null;
          const spoken = toText(finalRef.current);
          const languages = finalRef.current
            .map((t) => t.language)
            .filter((l): l is string => !!l);
          setHeard((h) => [...new Set([...h, ...languages])]);
          setText([baseRef.current, spoken].filter(Boolean).join('\n\n'));
          if (spoken) setDirty(true);
          setPending([]);
          setPhase('idle');
        },
      });
      setPhase((p) => (p === 'starting' ? 'live' : p));
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      live.current = null;
      setPhase('idle');
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in your browser’s site settings.'
          : errorMessage(e),
      );
    }
  }

  function stop() {
    setPhase('stopping');
    window.clearInterval(timer.current);
    live.current?.stop();
  }

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const fallback = `Transcript ${new Date().toLocaleString()}`;
      if (savedId) {
        await api.put(`/voice/transcripts/${savedId}`, {
          title: title.trim() || fallback,
          text,
        });
      } else {
        const { data } = await api.post<VoiceTranscript>('/voice/transcripts', {
          title: title.trim() || fallback,
          text,
          languages: heard,
          duration_seconds: seconds,
          project_id: currentProject ?? null,
        });
        setSavedId(data.id);
        if (!title.trim()) setTitle(data.title);
      }
      setDirty(false);
      setError('');
      await qc.invalidateQueries({ queryKey: ['/voice/transcripts'] });
      toast.success('Transcript saved');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (
      dirty &&
      !(await confirm('Discard the unsaved transcript and start a new one?', {
        okText: 'Discard',
      }))
    )
      return;
    setText('');
    setTitle('');
    setBase('');
    setSeconds(0);
    setHeard([]);
    setSavedId(null);
    setDirty(false);
    setError('');
  }

  const list = (transcripts.data ?? []).filter((t) =>
    `${t.title} ${t.text}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <>
      <PageBar crumbs={['Speech to text']} />
      <PageBody>
        <div className="mx-auto flex max-w-[1080px] flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-[20px] font-semibold tracking-tight">
              Speech to text
            </h1>
            <p className="text-[13px] text-ink-2">
              Live transcription powered by Soniox. Speak in any mix of
              languages: each word is recognized in its own language as you
              talk.
            </p>
          </div>

          <Card className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {recording ? (
                <Button
                  variant="danger"
                  icon={<Square className="fill-current" />}
                  loading={phase !== 'live'}
                  onClick={stop}
                >
                  {phase === 'starting'
                    ? 'Connecting…'
                    : phase === 'stopping'
                      ? 'Finishing…'
                      : 'Stop'}
                </Button>
              ) : (
                <Button variant="primary" icon={<Mic />} onClick={start}>
                  {text ? 'Continue recording' : 'Start recording'}
                </Button>
              )}
              <LanguagePicker
                languages={prefs.languages}
                strict={prefs.strict}
                disabled={recording}
                onChange={updatePrefs}
              />
              <span
                className={cn(
                  'tnum ml-1 inline-flex items-center gap-1.5 text-[13px] font-medium',
                  phase === 'live' ? 'text-red-600' : 'text-ink-3',
                )}
              >
                {phase === 'live' && (
                  <i className="block size-2 animate-pulse rounded-full bg-red-500" />
                )}
                {clock(seconds)}
              </span>
              <span className="flex-1" />
              <Button
                variant="ghost"
                icon={<Plus />}
                disabled={recording || (!text && !title)}
                onClick={reset}
              >
                New
              </Button>
              <Button
                icon={<Copy />}
                disabled={recording || !text.trim()}
                onClick={() => copy(text)}
              >
                Copy
              </Button>
              <Button
                variant="primary"
                icon={<Save />}
                disabled={recording || !text.trim() || (!dirty && !!savedId)}
                loading={saving}
                onClick={save}
              >
                {savedId && !dirty ? 'Saved' : 'Save transcript'}
              </Button>
            </div>
            <Input
              aria-label="Title"
              placeholder="Title (optional), e.g. Standup notes June 2"
              value={title}
              maxLength={200}
              onChange={(e) => {
                setTitle(e.target.value);
                if (text) setDirty(true);
              }}
            />
            {error && <Note tone="red">{error}</Note>}
            {recording ? (
              <LiveView base={base} final={final} pending={pending} />
            ) : (
              <Textarea
                aria-label="Transcript"
                rows={12}
                placeholder="Your spoken words appear here in real time. You can edit them before saving."
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setDirty(true);
                }}
                className="min-h-[300px] text-[14px] leading-relaxed"
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              {heard.map((l) => (
                <Tag key={l}>{languageName(l)}</Tag>
              ))}
              <span className="flex-1" />
              <Button
                size="sm"
                variant="ghost"
                icon={<FilePlus2 />}
                disabled={recording || !text.trim()}
                onClick={() =>
                  create({
                    project_id: currentProject,
                    summary: (
                      title.trim() || text.trim().split(/[.!?\n]/)[0]
                    ).slice(0, 120),
                    description: text.trim(),
                  })
                }
              >
                Create issue from transcript
              </Button>
            </div>
          </Card>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">
                Saved transcripts{' '}
                <span className="font-medium text-ink-3">
                  {transcripts.data?.length ?? ''}
                </span>
              </h2>
              <Input
                size="sm"
                icon={<Search />}
                aria-label="Search transcripts"
                placeholder="Search transcripts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </div>
            <State loading={transcripts.isLoading} error={transcripts.error} />
            {transcripts.data && !list.length && (
              <Card>
                <Empty
                  icon={<Mic />}
                  title={
                    transcripts.data.length
                      ? 'No matches'
                      : 'No saved transcripts yet'
                  }
                >
                  {transcripts.data.length
                    ? 'No transcript matches this search.'
                    : 'Record something and press Save transcript.'}
                </Empty>
              </Card>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOpen(t)}
                  className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3.5 text-left shadow-sm transition hover:border-line-2 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-1 text-[13.5px] font-semibold">
                      {t.title}
                    </span>
                    <Badge className="tnum shrink-0">
                      {clock(t.duration_seconds)}
                    </Badge>
                  </div>
                  <p className="line-clamp-3 text-[12.5px] leading-relaxed text-ink-2">
                    {t.text}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-[11.5px] text-ink-3">
                    <span>{when(t.created_at)}</span>
                    {t.project && <span>· {t.project.name}</span>}
                    {t.languages.slice(0, 3).map((l) => (
                      <span
                        key={l}
                        className="rounded bg-hover px-1 font-mono text-[10.5px] uppercase"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </PageBody>
      {open && (
        <TranscriptDialog transcript={open} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
