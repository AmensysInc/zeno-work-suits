'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useMe } from '@/hooks/data';

// The call UI (LiveKit) is large and browser-only, so it loads when a call opens.
const CallRoom = dynamic(() => import('@/components/chat/call-room'), { ssr: false });

/** A project chat's call, or a calendar meeting's own call. */
export type CallTarget = { kind: 'project' | 'meeting'; id: number; title: string };

export const sameCall = (a: CallTarget | null, b: Pick<CallTarget, 'kind' | 'id'>) =>
  !!a && a.kind === b.kind && a.id === b.id;

const base = (t: Pick<CallTarget, 'kind' | 'id'>) => (t.kind === 'project' ? `/projects/${t.id}` : `/meetings/${t.id}`);

type CallApi = {
  /** The call this person is in (or setting up), if any. */
  call: CallTarget | null;
  minimized: boolean;
  /** Opens a call, or brings back the one already open for it. */
  open: (call: CallTarget) => void;
};

const CallContext = createContext<CallApi | null>(null);

/**
 * Keeps one call alive for the whole signed-in app, so it can be minimized to
 * a small floating window while the person moves between pages, like Teams.
 * It ends only on Leave, sign-out or a full page reload.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const [call, setCall] = useState<CallTarget | null>(null);
  const [minimized, setMinimized] = useState(false);
  const me = useMe();
  const qc = useQueryClient();

  const refresh = useCallback(
    (target: CallTarget) => {
      qc.invalidateQueries({ queryKey: [`${base(target)}/call`] });
      if (target.kind === 'project') qc.invalidateQueries({ queryKey: [`/projects/${target.id}/chat`] });
    },
    [qc],
  );

  const open = useCallback(
    (next: CallTarget) => {
      if (call && !sameCall(call, next)) {
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
          key={`${call.kind}-${call.id}`}
          joinPath={`${base(call)}/call/join`}
          title={call.title}
          userName={fullName}
          minimized={minimized}
          onMinimize={() => setMinimized(true)}
          onExpand={() => setMinimized(false)}
          onJoined={() => refresh(call)}
          onClose={() => {
            refresh(call);
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
