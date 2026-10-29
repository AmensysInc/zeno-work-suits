'use client';

import { useEffect, useState } from 'react';
import { Button } from './button';
import { Dialog } from './dialog';
import { Input } from './input';

type Request =
  | { kind: 'confirm'; content: string; okText: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: 'prompt'; title: string; initial: string; resolve: (v: string | null) => void };

let show: ((r: Request) => void) | undefined;

/** Mounted once in the providers so confirm() and prompt() can open dialogs from anywhere. */
export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [value, setValue] = useState('');
  useEffect(() => {
    show = (r) => {
      setValue(r.kind === 'prompt' ? r.initial : '');
      setReq(r);
    };
    return () => {
      show = undefined;
    };
  }, []);
  if (!req) return null;
  const close = (ok: boolean) => {
    if (req.kind === 'confirm') req.resolve(ok);
    else req.resolve(ok ? value : null);
    setReq(null);
  };
  return (
    <Dialog
      onClose={() => close(false)}
      width={420}
      title={req.kind === 'confirm' ? 'Are you sure?' : req.title}
      footer={
        <>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button
            variant={req.kind === 'confirm' && req.danger ? 'danger' : 'primary'}
            onClick={() => close(true)}
            autoFocus
          >
            {req.kind === 'confirm' ? req.okText : 'OK'}
          </Button>
        </>
      }
    >
      {req.kind === 'confirm' ? (
        <p className="text-[13px] leading-relaxed text-ink-2">{req.content}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            close(true);
          }}
        >
          <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} aria-label={req.title} />
        </form>
      )}
    </Dialog>
  );
}

/** Themed replacement for window.confirm. Resolves true when confirmed. */
export function confirm(content: string, { danger = true, okText = 'Confirm' } = {}): Promise<boolean> {
  if (!show) return Promise.resolve(window.confirm(content));
  return new Promise((resolve) => show!({ kind: 'confirm', content, okText, danger, resolve }));
}

/** Themed replacement for window.prompt. Resolves null when cancelled. */
export function prompt(title: string, initial = ''): Promise<string | null> {
  if (!show) return Promise.resolve(window.prompt(title, initial));
  return new Promise((resolve) => show!({ kind: 'prompt', title, initial, resolve }));
}
