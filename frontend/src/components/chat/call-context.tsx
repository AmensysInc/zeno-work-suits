'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMe } from '@/hooks/data';

// The call UI (LiveKit) is large and browser-only, so it loads when a call opens.
const CallRoom = dynamic(() => import('@/components/chat/call-room'), { ssr: false });

type ActiveCall = { projectId: number; title: string };

type CallApi = {
  /** The call this person is in (or setting up), if any. */
  call: ActiveCall | null;
  minimized: boolean;
  /** Opens a project's call, or brings back the one already open for it. */
  open: (call: ActiveCall) => void;
};

const CallContext = createContext<CallApi | null>(null);

/**
 * Keeps one project call alive for the whole signed-in app, so it can be
 * minimized to a small floating window while the person moves between pages,
 * like Teams. It ends only on Leave, sign-out or a full page reload.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [minimized, setMinimized] = useState(false);
  const me = useMe();
  const qc = useQueryClient();

  const refresh = useCallback(
    (projectId: number) => {
      qc.invalidateQueries({ queryKey: [`/projects/${projectId}/call`] });
      qc.invalidateQueries({ queryKey: [`/projects/${projectId}/chat`] });
    },
    [qc],
  );

  const open = useCallback(
    (next: ActiveCall) => {
      if (call && call.projectId !== next.projectId) {
        toast.error(`You are already in the ${call.title} call. Leave it before joining another.`);
      } else {
        setCall(next);
      }
      setMinimized(false);
    },
    [call],
  );

  const value = useMemo(() => ({ call, minimized, open }), [call, minimized, open]);
  const fullName = me.data ? `${me.data.first_name} ${me.data.last_name}`.trim() : '';

  return (
    <CallContext.Provider value={value}>
      {children}
      {call && (
        <CallRoom
          key={call.projectId}
          projectId={call.projectId}
          title={call.title}
          userName={fullName}
          minimized={minimized}
          onMinimize={() => setMinimized(true)}
          onExpand={() => setMinimized(false)}
          onJoined={() => refresh(call.projectId)}
          onClose={() => {
            refresh(call.projectId);
            setCall(null);
            setMinimized(false);
          }}
        />
      )}
    </CallContext.Provider>
  );
}

export function useCall() {
  const value = useContext(CallContext);
  if (!value) throw new Error('useCall must be used inside CallProvider');
  return value;
}
