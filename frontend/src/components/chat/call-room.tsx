'use client';

import '@livekit/components-styles';
import './call-room.css';
import { useState } from 'react';
import {
  ControlBar,
  LiveKitRoom,
  ParticipantTile,
  PreJoin,
  RoomAudioRenderer,
  useParticipants,
  useTracks,
  VideoConference,
  type LocalUserChoices,
} from '@livekit/components-react';
import { MediaDeviceFailure, Track } from 'livekit-client';
import { Maximize2, Minimize2, MonitorUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

type Join = { url: string; token: string; room: string };

/**
 * What to tell the person when a device can't be used, or null to say nothing.
 * LiveKit reports screen sharing with no `kind`, and pressing Cancel in the
 * browser's share picker arrives as "permission denied". That is a normal
 * choice, not an error.
 */
function deviceFailureMessage(failure?: MediaDeviceFailure, kind?: MediaDeviceKind): string | null {
  if (!kind) {
    return failure === MediaDeviceFailure.PermissionDenied ? null : 'Screen sharing could not start. Try again.';
  }
  const device = kind === 'videoinput' ? 'camera' : 'microphone';
  if (failure === MediaDeviceFailure.PermissionDenied)
    return `Your ${device} is blocked. Allow it in the browser's site settings (the icon next to the address bar).`;
  if (failure === MediaDeviceFailure.NotFound) return `No ${device} was found on this device.`;
  if (failure === MediaDeviceFailure.DeviceInUse) return `Your ${device} is being used by another app. Close it and try again.`;
  return `Could not use your ${device}.`;
}

/**
 * The minimized call: one tile (someone else's shared screen first, then
 * another person, then you) and the basic controls. Your own screen share is
 * never shown back to you, which avoids the "hall of mirrors".
 */
function MiniStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const people = useParticipants();
  const sharing = tracks.some((t) => t.participant.isLocal && t.source === Track.Source.ScreenShare);
  const visible = tracks.filter((t) => !(t.participant.isLocal && t.source === Track.Source.ScreenShare));
  const shown =
    visible.find((t) => t.source === Track.Source.ScreenShare) ??
    visible.find((t) => !t.participant.isLocal) ??
    visible[0];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 p-1.5">
        {shown && <ParticipantTile trackRef={shown} className="h-full" />}
        <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium">
          {people.length} in call
        </span>
        {sharing && (
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded bg-[#1f8cf9] px-1.5 py-0.5 text-[11px] font-semibold">
            <MonitorUp className="size-3" /> Sharing
          </span>
        )}
      </div>
      <ControlBar
        variation="minimal"
        controls={{ microphone: true, camera: true, screenShare: true, leave: true, chat: false, settings: false }}
      />
      <RoomAudioRenderer />
    </div>
  );
}

/**
 * A project call on the self-hosted LiveKit server. A device check (camera /
 * microphone) comes first; the join token is requested only when the person
 * presses Join, so "started a call" is posted only for real joins. Once in, the
 * call can be minimized to a floating window and stays connected while the
 * person uses the rest of the app.
 */
export default function CallRoom({
  projectId,
  title,
  userName,
  minimized,
  onMinimize,
  onExpand,
  onClose,
  onJoined,
}: {
  projectId: number;
  title: string;
  userName: string;
  minimized: boolean;
  onMinimize: () => void;
  onExpand: () => void;
  onClose: () => void;
  onJoined?: () => void;
}) {
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [join, setJoin] = useState<Join | null>(null);
  const [joining, setJoining] = useState(false);
  const mini = minimized && !!join;

  const start = async (values: LocalUserChoices) => {
    if (joining) return;
    setJoining(true);
    try {
      const res = await api.post<Join>(`/projects/${projectId}/call/join`);
      setChoices(values);
      setJoin(res.data);
      onJoined?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setJoining(false);
    }
  };

  const iconButton =
    'grid size-8 shrink-0 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white';

  return (
    <div
      role={mini ? 'region' : 'dialog'}
      aria-modal={mini ? undefined : true}
      aria-label={`${title} call`}
      data-lk-theme="default"
      className={cn(
        'zeno-call fixed z-50 flex flex-col bg-[#111] text-white',
        mini
          ? 'zeno-call-mini bottom-4 right-4 h-[280px] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 shadow-2xl'
          : 'inset-0',
      )}
    >
      <header className={cn('flex shrink-0 items-center gap-2 border-b border-white/10', mini ? 'h-10 px-2.5' : 'h-12 px-4')}>
        <span className={cn('min-w-0 flex-1 truncate font-semibold', mini ? 'text-[12.5px]' : 'text-[14px]')}>
          {title} · Call
        </span>
        {join &&
          (mini ? (
            <button type="button" aria-label="Expand call" title="Expand" onClick={onExpand} className={iconButton}>
              <Maximize2 className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onMinimize}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Minimize2 className="size-4" /> Minimize
            </button>
          ))}
        {!join && (
          <button type="button" aria-label="Close" onClick={onClose} className={iconButton}>
            <X className="size-4" />
          </button>
        )}
      </header>
      {join && choices ? (
        // One LiveKitRoom for both sizes, so minimizing never drops the connection.
        <LiveKitRoom
          serverUrl={join.url}
          token={join.token}
          connect
          audio={choices.audioEnabled ? { deviceId: choices.audioDeviceId || undefined } : false}
          video={choices.videoEnabled ? { deviceId: choices.videoDeviceId || undefined } : false}
          onDisconnected={onClose}
          onError={(e) => toast.error(e.message)}
          onMediaDeviceFailure={(failure, kind) => {
            const message = deviceFailureMessage(failure, kind);
            if (message) toast.error(message);
          }}
          className="min-h-0 flex-1"
        >
          {mini ? <MiniStage /> : <VideoConference />}
        </LiveKitRoom>
      ) : (
        // The name comes from the account; call-room.css hides PreJoin's name box.
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-4">
          <div className="flex w-full max-w-[560px] flex-col gap-3">
            <p className="text-center text-[13px] text-white/70">Check your camera and microphone, then join.</p>
            <PreJoin
              defaults={{ username: userName, videoEnabled: false, audioEnabled: true }}
              onValidate={() => true}
              onSubmit={(values) => void start({ ...values, username: userName })}
              onError={(e) => toast.error(e.message)}
              joinLabel={joining ? 'Joining…' : 'Join call'}
              micLabel="Microphone"
              camLabel="Camera"
            />
          </div>
        </div>
      )}
    </div>
  );
}
