'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Mic, Plus, Square } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { PageBar, PageBody } from '@/components/layout/page';
import { useCreateIssue } from '@/components/layout/context';
import { Card, Note } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'done';
const POLL_MS = 5000;

export default function VoiceAgentPage() {
  const create = useCreateIssue();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function start() {
    setError('');
    setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void upload(new Blob(chunks.current, { type: rec.mimeType }));
      };
      rec.start();
      recorder.current = rec;
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setPhase('recording');
    } catch {
      setError('Microphone access was blocked. Allow it in your browser.');
    }
  }
  function stop() {
    window.clearInterval(timer.current);
    recorder.current?.stop();
  }
  async function upload(audio: Blob) {
    setPhase('uploading');
    try {
      const body = new FormData();
      body.append('file', audio, 'voice-note.webm');
      const { data } = await api.post<{ id: string }>('/voice/transcriptions', body);
      setPhase('transcribing');
      await poll(data.id);
    } catch (e) {
      setError(errorMessage(e));
      setPhase('idle');
    }
  }
  async function poll(id: string) {
    for (;;) {
      const { data } = await api.get<{ status: string; transcript: string | null }>(`/voice/transcriptions/${id}`);
      if (data.status === 'completed') {
        setTranscript(data.transcript ?? '');
        setPhase('done');
        toast.success('Transcript ready');
        return;
      }
      if (data.status === 'failed') throw new Error('Transcription failed');
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
  const busy = phase === 'uploading' || phase === 'transcribing';
  const recording = phase === 'recording';
  return (
    <>
      <PageBar crumbs={['Voice agent']} />
      <PageBody>
        <div className="mx-auto flex max-w-[680px] flex-col gap-4">
          <p className="text-[13px] text-ink-2">Record a voice note, transcribe it with Sonix, and turn it into an issue.</p>
          <Card className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <button
              onClick={recording ? stop : start}
              disabled={busy}
              aria-label={recording ? 'Stop recording' : 'Start recording'}
              className={cn(
                'flex size-20 items-center justify-center rounded-full text-white shadow-lg transition disabled:opacity-50',
                recording ? 'animate-pulse bg-red-500 ring-8 ring-red-500/15' : 'bg-accent ring-8 ring-accent/10 hover:bg-accent-2',
              )}
            >
              {recording ? <Square className="size-7 fill-current" /> : busy ? <Loader2 className="size-8 animate-spin" /> : <Mic className="size-8" />}
            </button>
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold">{recording ? `Recording… ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : busy ? (phase === 'uploading' ? 'Uploading to Sonix…' : 'Transcribing…') : 'Tap to record'}</span>
              <span role="status" className="text-[12.5px] text-ink-3">
                {recording ? 'Tap again to stop and transcribe.' : busy ? 'This can take a minute or two.' : 'Describe a bug or task out loud.'}
              </span>
            </div>
          </Card>
          {error && <Note tone="red">{error}</Note>}
          {phase === 'done' && (
            <Card className="flex flex-col gap-3 p-4">
              <label htmlFor="voice-transcript" className="text-[13px] font-semibold">
                Transcript
              </label>
              <Textarea id="voice-transcript" rows={8} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  icon={<Plus />}
                  disabled={!transcript.trim()}
                  onClick={() => create({ summary: transcript.trim().split(/[.!?\n]/)[0].slice(0, 120), description: transcript.trim() })}
                >
                  Create issue from transcript
                </Button>
              </div>
            </Card>
          )}
        </div>
      </PageBody>
    </>
  );
}
