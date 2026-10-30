'use client';

import { api } from '@/lib/api';

/** One recognized piece of speech; Soniox tags each with its own language. */
export type LiveToken = {
  text: string;
  is_final: boolean;
  language?: string;
  speaker?: string;
};

type Session = { api_key: string; websocket_url: string; model: string };

// Converts the mic signal to 16-bit PCM in ~100 ms chunks, off the main thread.
const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.size = Math.round(sampleRate / 10); this.buf = new Int16Array(this.size); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.size) {
        this.port.postMessage(this.buf.buffer, [this.buf.buffer]);
        this.buf = new Int16Array(this.size);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
`;

// Control markers Soniox sends for endpoints and finalization; never shown.
const MARKERS = new Set(['<end>', '<fin>']);

export interface LiveOptions {
  /** Languages the speakers use; Soniox prefers these and still detects switches between them. */
  languages: string[];
  /** Write only in the listed languages, so speech never comes out in another script. */
  strict: boolean;
  onTokens: (final: LiveToken[], pending: LiveToken[]) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

/** Streams the microphone to Soniox and reports words as they are recognized. */
export async function startLive({
  languages,
  strict,
  onTokens,
  onError,
  onEnd,
}: LiveOptions) {
  const session = (await api.post<Session>('/voice/session')).data;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const ctx = new AudioContext();
  const moduleUrl = URL.createObjectURL(
    new Blob([WORKLET], { type: 'application/javascript' }),
  );
  try {
    await ctx.audioWorklet.addModule(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'pcm-capture');
  // A silent sink keeps the audio graph pulling samples in every browser.
  const sink = ctx.createGain();
  sink.gain.value = 0;
  node.connect(sink).connect(ctx.destination);

  let ended = false;
  const release = () => {
    source.disconnect();
    node.port.onmessage = null;
    stream.getTracks().forEach((t) => t.stop());
    if (ctx.state !== 'closed') void ctx.close();
  };
  const finish = () => {
    if (ended) return;
    ended = true;
    release();
    onEnd();
  };

  // The temporary key goes in the protocols list; the account key stays on the server.
  const ws = new WebSocket(session.websocket_url, [
    'soniox-api-key',
    session.api_key,
  ]);
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        model: session.model,
        audio_format: 'pcm_s16le',
        sample_rate: ctx.sampleRate,
        num_channels: 1,
        enable_language_identification: true,
        enable_speaker_diarization: true,
        enable_endpoint_detection: true,
        ...(languages.length ? { language_hints: languages } : {}),
        ...(strict && languages.length ? { language_hints_strict: true } : {}),
      }),
    );
    node.port.onmessage = (e) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(e.data as ArrayBuffer);
    };
    source.connect(node);
  };
  const final: LiveToken[] = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(String(e.data)) as {
      tokens?: LiveToken[];
      finished?: boolean;
      error_code?: number;
      error_message?: string;
    };
    if (msg.error_code) {
      onError(msg.error_message || `Soniox error ${msg.error_code}`);
      finish();
      return;
    }
    if (msg.tokens?.length) {
      const pending: LiveToken[] = [];
      for (const t of msg.tokens) {
        if (MARKERS.has(t.text)) continue;
        (t.is_final ? final : pending).push(t);
      }
      onTokens([...final], pending);
    }
    if (msg.finished) finish();
  };
  ws.onerror = () => {
    if (!ended)
      onError(
        'The live transcription connection failed. Check your network and try again.',
      );
  };
  ws.onclose = finish;

  return {
    /** Stops the mic; Soniox finalizes the last words, then the stream ends. */
    stop() {
      release();
      // An empty text frame ends the stream; the server sends the rest, then closes.
      if (ws.readyState === WebSocket.OPEN) ws.send('');
      window.setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) ws.close();
      }, 8000);
    },
  };
}

const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' });
export const languageName = (code: string) => {
  try {
    return LANGUAGE_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
};

/** Consecutive tokens grouped by speaker and language, for display and saving. */
export function segments(tokens: LiveToken[]) {
  const out: {
    speaker?: string;
    language?: string;
    text: string;
    final: boolean;
  }[] = [];
  for (const t of tokens) {
    const last = out.at(-1);
    if (
      last &&
      last.speaker === t.speaker &&
      last.language === t.language &&
      last.final === t.is_final
    )
      last.text += t.text;
    else
      out.push({
        speaker: t.speaker,
        language: t.language,
        text: t.text,
        final: t.is_final,
      });
  }
  return out;
}

/** Plain text for saving; speaker turns start new lines when several people spoke. */
export function toText(tokens: LiveToken[]) {
  const speakers = new Set(tokens.map((t) => t.speaker).filter(Boolean));
  if (speakers.size < 2)
    return tokens
      .map((t) => t.text)
      .join('')
      .trim();
  let text = '';
  let speaker: string | undefined;
  for (const t of tokens) {
    if (t.speaker && t.speaker !== speaker) {
      speaker = t.speaker;
      text += `${text ? '\n' : ''}Speaker ${speaker}: `;
      text += t.text.trimStart();
    } else text += t.text;
  }
  return text.trim();
}

/** Segments marked where a new speaker turn starts or the language switches. */
export function markedSegments(final: LiveToken[], pending: LiveToken[]) {
  const multiSpeaker =
    new Set(final.map((t) => t.speaker).filter(Boolean)).size > 1;
  const out = [];
  let speaker: string | undefined;
  let language: string | undefined;
  for (const part of segments([...final, ...pending])) {
    out.push({
      ...part,
      newSpeaker: !!(multiSpeaker && part.speaker && part.speaker !== speaker),
      newLanguage: !!(part.language && part.language !== language),
    });
    speaker = part.speaker ?? speaker;
    language = part.language ?? language;
  }
  return out;
}
