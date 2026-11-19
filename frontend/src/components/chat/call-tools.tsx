'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useParticipants, useRoomContext } from '@livekit/components-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Captions, Circle, Languages, Square } from 'lucide-react';
import { api, errorMessage, getToken } from '@/lib/api';
import { mixCallAudio, TRANSLATE_LANGUAGES } from '@/lib/call-audio';
import { languageName, startLive, toText, type LiveToken } from '@/lib/soniox-live';
import { cn } from '@/lib/utils';
import type { CallTranscript } from '@/types';
import type { CallTarget } from './call-context';

/** How often the recorder saves the transcript so far. */
const SAVE_EVERY_MS = 10_000;
const LANGUAGE_KEY = 'zeno_call_translate';
const CAPTION_CHARS = 180;

type Live = Awaited<ReturnType<typeof startLive>>;

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** The end of a long string, cut at a word, for captions. */
const tail = (text: string) => {
  const t = text.trim();
  if (t.length <= CAPTION_CHARS) return t;
  const cut = t.slice(-CAPTION_CHARS);
  return `…${cut.slice(cut.indexOf(' ') + 1)}`;
};

/**
 * Records the call with Soniox: everyone's audio (yours and the others') is
 * mixed in this browser and transcribed with speaker labels. The text is saved
 * every few seconds, and on Stop the transcript goes to the meeting's chat (or
 * the project chat). Everyone in the call sees a "Recording" badge.
 */
function useRecorder(target: CallTarget) {
  const room = useRoomContext();
  const qc = useQueryClient();
  const [state, setState] = useState<'idle' | 'starting' | 'recording' | 'stopping'>('idle');
  const [startedAt, setStartedAt] = useState(0);
  const id = useRef<number | null>(null);
  const live = useRef<Live | null>(null);
  const mixer = useRef<ReturnType<typeof mixCallAudio> | null>(null);
  const tokens = useRef<LiveToken[]>([]);
  const saved = useRef('');
  const timer = useRef<number | undefined>(undefined);
  const ended = useRef(false);

  const body = (finished: boolean) => ({
    text: toText(tokens.current),
    languages: [...new Set(tokens.current.map((t) => t.language).filter(Boolean))] as string[],
    finished,
  });

  const save = useCallback(async (finished: boolean) => {
    if (id.current === null) return;
    const data = body(finished);
    if (!finished && data.text === saved.current) return;
    saved.current = data.text;
    await api.put(`/calls/transcripts/${id.current}`, data);
  }, []);

  const badge = useCallback(
    (on: boolean) => {
      // Everyone in the call reads this attribute to show the Recording badge.
      room.localParticipant.setAttributes({ recording: on ? '1' : '' }).catch(() => undefined);
    },
    [room],
  );

  /** Runs once when the Soniox stream has delivered its last words. */
  const finish = useCallback(async () => {
    if (ended.current) return;
    ended.current = true;
    window.clearInterval(timer.current);
    mixer.current?.stop();
    mixer.current = null;
    live.current = null;
    badge(false);
    try {
      await save(true);
      toast.success(
        target.kind === 'meeting' ? 'Transcript saved to the meeting chat' : 'Transcript saved to the project chat',
      );
    } catch (e) {
      toast.error(errorMessage(e));
    }
    id.current = null;
    setState('idle');
    qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes('/transcripts') });
  }, [badge, qc, save, target.kind]);

  const start = async () => {
    if (state !== 'idle') return;
    setState('starting');
    ended.current = false;
    tokens.current = [];
    saved.current = '';
    try {
      const created = (
        await api.post<CallTranscript>('/calls/transcripts', target.kind === 'meeting' ? { meeting_id: target.id } : { project_id: target.id })
      ).data;
      id.current = created.id;
      mixer.current = mixCallAudio(room, { includeSelf: true });
      live.current = await startLive({
        languages: [],
        strict: false,
        stream: mixer.current.stream,
        onTokens: (final) => {
          tokens.current = final;
        },
        onError: (message) => toast.error(message),
        onEnd: () => void finish(),
      });
      timer.current = window.setInterval(() => void save(false).catch(() => undefined), SAVE_EVERY_MS);
      badge(true);
      setStartedAt(Date.now());
      setState('recording');
      toast.success('Recording started. Everyone in the call can see it.');
    } catch (e) {
      mixer.current?.stop();
      mixer.current = null;
      if (id.current !== null) await save(true).catch(() => undefined);
      id.current = null;
      setState('idle');
      toast.error(errorMessage(e));
    }
  };

  const stop = () => {
    if (state !== 'recording') return;
    setState('stopping');
    // Soniox sends the last words, then ends the stream, which calls finish().
    if (live.current) live.current.stop();
    else void finish();
  };

  // Leaving the call (or closing the tab) still saves what was said.
  useEffect(() => {
    const onUnload = () => {
      if (id.current === null) return;
      void fetch(`/api/calls/transcripts/${id.current}`, {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(body(true)),
      });
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      if (live.current) live.current.stop();
      else if (id.current !== null) void finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, startedAt, start, stop };
}

/** Live captions of what the others say, translated into the chosen language. */
function useTranslator() {
  const room = useRoomContext();
  const [language, setLanguage] = useState('');
  const [captions, setCaptions] = useState({ original: '', translated: '' });

  useEffect(() => {
    try {
      setLanguage(localStorage.getItem(LANGUAGE_KEY) ?? '');
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    if (!language) return;
    let cancelled = false;
    let handle: Live | null = null;
    const mixer = mixCallAudio(room, { includeSelf: false });
    startLive({
      languages: [],
      strict: false,
      stream: mixer.stream,
      translateTo: language,
      diarize: false,
      onTokens: (final, pending) => {
        const all = [...final.slice(-400), ...pending];
        setCaptions({
          original: tail(all.filter((t) => t.translation_status !== 'translation').map((t) => t.text).join('')),
          translated: tail(all.filter((t) => t.translation_status === 'translation').map((t) => t.text).join('')),
        });
      },
      onError: (message) => toast.error(message),
      onEnd: () => undefined,
    })
      .then((h) => {
        if (cancelled) h.stop();
        else handle = h;
      })
      .catch((e) => {
        toast.error(errorMessage(e));
        setLanguage('');
      });
    return () => {
      cancelled = true;
      handle?.stop();
      mixer.stop();
      setCaptions({ original: '', translated: '' });
    };
  }, [language, room]);

  const choose = (code: string) => {
    setLanguage(code);
    try {
      localStorage.setItem(LANGUAGE_KEY, code);
    } catch {
      /* storage unavailable */
    }
  };
  return { language, choose, captions };
}

/** Who is recording right now, from LiveKit participant attributes. */
function useRecordingBy() {
  const people = useParticipants();
  return people.filter((p) => p.attributes?.recording === '1').map((p) => p.name || p.identity);
}

/**
 * Record and Live translation for a call. Renders through children so the
 * buttons can sit in the call's header and the captions over the video.
 */
export function CallTools({
  target,
  mini,
  children,
}: {
  target: CallTarget;
  mini: boolean;
  children: (tools: ReactNode, overlay: ReactNode) => ReactNode;
}) {
  const recorder = useRecorder(target);
  const translator = useTranslator();
  const recordingBy = useRecordingBy();
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (recorder.state !== 'recording') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [recorder.state]);

  const mine = recorder.state === 'recording' || recorder.state === 'stopping';
  const someoneElse = !mine && recordingBy.length > 0;
  const elapsed = mine ? clock(Math.max(0, now - recorder.startedAt) / 1000) : '';

  const button = 'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-white/85 hover:bg-white/10 hover:text-white disabled:opacity-50';
  const tools = mini ? (
    (mine || someoneElse) && <span aria-label="Recording" title="Recording" className="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
  ) : (
    <>
      {mine ? (
        <button type="button" onClick={recorder.stop} disabled={recorder.state === 'stopping'} className={cn(button, 'bg-red-600/90 text-white hover:bg-red-600')}>
          <Square className="size-3.5 fill-current" />
          {recorder.state === 'stopping' ? 'Saving…' : `Stop recording · ${elapsed}`}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void recorder.start()}
          disabled={recorder.state === 'starting' || someoneElse}
          title={someoneElse ? `${recordingBy.join(', ')} is recording` : 'Transcribe this call with Soniox AI'}
          className={button}
        >
          <Circle className="size-3.5 fill-red-500 text-red-500" />
          {recorder.state === 'starting' ? 'Starting…' : 'Record'}
        </button>
      )}
      <label className={cn(button, 'cursor-pointer', translator.language && 'bg-white/10 text-white')} title="Live translation of what others say">
        <Languages className="size-4" />
        <span className="sr-only sm:not-sr-only">Translate</span>
        <select
          aria-label="Live translation language"
          value={translator.language}
          onChange={(e) => translator.choose(e.target.value)}
          className="max-w-[120px] cursor-pointer bg-transparent text-[13px] outline-none [&>option]:bg-[#222]"
        >
          <option value="">Off</option>
          {TRANSLATE_LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {languageName(code)}
            </option>
          ))}
        </select>
      </label>
    </>
  );

  const showCaptions = !!translator.language && !mini && (translator.captions.original || translator.captions.translated);
  const overlay = (
    <>
      {(mine || someoneElse) && !mini && (
        <span role="status" className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[12px] font-medium">
          <span className="size-2 animate-pulse rounded-full bg-red-500" />
          Recording{someoneElse ? ` · ${recordingBy.join(', ')}` : ''}
        </span>
      )}
      {showCaptions && (
        <div aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-[84px] z-10 flex justify-center px-4">
          <div className="max-w-[760px] rounded-lg bg-black/75 px-4 py-2 text-center">
            {translator.captions.translated && <p className="text-[17px] font-medium leading-snug">{translator.captions.translated}</p>}
            {translator.captions.original && (
              <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[12.5px] text-white/60">
                <Captions className="size-3.5 shrink-0" />
                {translator.captions.original}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
  return <>{children(tools, overlay)}</>;
}
