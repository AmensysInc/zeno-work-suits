'use client';

import { RoomEvent, Track, type Room } from 'livekit-client';

/**
 * Mixes a LiveKit call's audio into one stream for Soniox: everyone else's
 * voices, plus your own microphone when `includeSelf` is set. People who join,
 * leave, mute or switch microphones are followed automatically.
 */
export function mixCallAudio(room: Room, { includeSelf }: { includeSelf: boolean }) {
  const ctx = new AudioContext();
  const out = ctx.createMediaStreamDestination();
  const sources = new Map<string, MediaStreamAudioSourceNode>();

  const wanted = () => {
    const tracks = new Map<string, MediaStreamTrack>();
    for (const p of room.remoteParticipants.values()) {
      for (const pub of p.audioTrackPublications.values()) {
        // Voices, and the sound of a shared screen (a video someone plays).
        const track = pub.track?.mediaStreamTrack;
        if (track) tracks.set(track.id, track);
      }
    }
    if (includeSelf) {
      const mic = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack;
      if (mic) tracks.set(mic.id, mic);
    }
    return tracks;
  };

  const sync = () => {
    if (ctx.state === 'closed') return;
    const now = wanted();
    for (const [id, node] of sources) {
      if (!now.has(id)) {
        node.disconnect();
        sources.delete(id);
      }
    }
    for (const [id, track] of now) {
      if (sources.has(id) || track.readyState === 'ended') continue;
      const node = ctx.createMediaStreamSource(new MediaStream([track]));
      node.connect(out);
      sources.set(id, node);
    }
  };

  const events = [
    RoomEvent.TrackSubscribed,
    RoomEvent.TrackUnsubscribed,
    RoomEvent.LocalTrackPublished,
    RoomEvent.LocalTrackUnpublished,
    RoomEvent.ParticipantDisconnected,
    RoomEvent.TrackUnmuted,
    RoomEvent.MediaDevicesChanged,
  ] as const;
  for (const e of events) room.on(e, sync);
  // A safety net for track restarts (e.g. a new microphone) that raise no event.
  const timer = window.setInterval(sync, 3000);
  sync();
  void ctx.resume();

  return {
    stream: out.stream,
    stop() {
      window.clearInterval(timer);
      for (const e of events) room.off(e, sync);
      for (const node of sources.values()) node.disconnect();
      sources.clear();
      if (ctx.state !== 'closed') void ctx.close();
    },
  };
}

/** Languages Soniox can translate into, most used here first. */
export const TRANSLATE_LANGUAGES = [
  'en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'ur',
  'es', 'fr', 'de', 'ar', 'zh', 'ja', 'ko', 'pt', 'ru', 'it', 'nl',
  'tr', 'vi', 'id', 'th', 'pl', 'uk', 'sv', 'fa', 'he', 'ms', 'tl', 'sw',
];
