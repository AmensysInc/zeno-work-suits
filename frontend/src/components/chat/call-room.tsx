'use client';

import '@livekit/components-styles';
import './call-room.css';
import { useState } from 'react';
import { LiveKitRoom, PreJoin, VideoConference, type LocalUserChoices } from '@livekit/components-react';
import { MediaDeviceFailure } from 'livekit-client';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';

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
 * Full-screen project call on the self-hosted LiveKit server. A device check
 * (camera / microphone) comes first; the join token is requested only when
 * the person presses Join, so "started a call" is posted only for real joins.
 */
export default function CallRoom({
  projectId,
  title,
  userName,
  onClose,
  onJoined,
}: {
  projectId: number;
  title: string;
  userName: string;
  onClose: () => void;
  onJoined?: () => void;
}) {
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [join, setJoin] = useState<Join | null>(null);
  const [joining, setJoining] = useState(false);

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} call`}
      data-lk-theme="default"
      className="zeno-call fixed inset-0 z-50 flex flex-col bg-[#111] text-white"
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{title} · Call</span>
        {!join && (
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        )}
      </header>
      {join && choices ? (
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
          <VideoConference />
        </LiveKitRoom>
      ) : (
        // The name comes from the account, so the PreJoin name field is hidden.
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-4 [&_.lk-username-container]:hidden">
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
