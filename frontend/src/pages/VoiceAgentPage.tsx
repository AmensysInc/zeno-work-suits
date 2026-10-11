import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '../services/api';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/ui/shared';
import { useCreateIssue } from '../components/layout/AppShell';
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
      const { data } = await api.post<{ id: string }>(
        '/voice/transcriptions',
        body,
      );
      setPhase('transcribing');
      await poll(data.id);
    } catch (e) {
      setError(errorMessage(e));
      setPhase('idle');
    }
  }
  async function poll(id: string) {
    for (;;) {
      const { data } = await api.get<{
        status: string;
        transcript: string | null;
      }>(`/voice/transcriptions/${id}`);
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
  return (
    <>
      <PageHeader
        title="Voice Agent"
        description="Record a voice note, transcribe it with Sonix, and turn it into an issue."
      />
      <section className="card voice-agent">
        <div className="voice-controls">
          {phase === 'recording' ? (
            <Button variant="destructive" onClick={stop}>
              ■ Stop recording ({seconds}s)
            </Button>
          ) : (
            <Button onClick={start} disabled={busy}>
              ● Start recording
            </Button>
          )}
          {busy && (
            <span className="voice-status" role="status">
              {phase === 'uploading'
                ? 'Uploading to Sonix…'
                : 'Transcribing… this can take a minute or two.'}
            </span>
          )}
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {phase === 'done' && (
          <div className="voice-result">
            <label htmlFor="voice-transcript">Transcript</label>
            <textarea
              id="voice-transcript"
              rows={8}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
            <Button
              disabled={!transcript.trim()}
              onClick={() =>
                create({
                  summary: transcript.trim().split(/[.!?\n]/)[0].slice(0, 120),
                  description: transcript.trim(),
                })
              }
            >
              Create issue from transcript
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
