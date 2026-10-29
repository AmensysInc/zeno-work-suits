'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KeyRound, Lock } from 'lucide-react';
import { api, errorMessage, getToken, TOKEN_KEY } from '@/lib/api';
import { useMe } from '@/hooks/data';
import { AuthFrame } from '@/components/layout/auth-frame';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Note } from '@/components/ui/display';

const schema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: z.string().min(8, 'Use at least 8 characters').max(72),
    confirm: z.string(),
  })
  .refine((d) => d.new_password === d.confirm, { message: 'The new passwords don’t match', path: ['confirm'] });

/** 0–4: length, mixed case, digits, symbols. */
const strength = (p: string) =>
  p.length < 8 ? (p ? 1 : 0) : [/[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^\w]/.test(p)].filter(Boolean).length + 1;

// Shown on first sign-in with a temporary password, and from the profile menu.
export default function ChangePasswordPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (getToken()) setOk(true);
    else router.replace('/login');
  }, [router]);
  const me = useMe();
  const forced = !!me.data?.must_change_password;
  const { register, handleSubmit, watch, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const score = strength(watch('new_password') ?? '');
  if (!ok) return null;
  const submit = handleSubmit(async ({ current_password, new_password }) => {
    setError('');
    try {
      const r = await api.post('/auth/change-password', { current_password, new_password });
      // A new password signs out older tokens, including this one.
      localStorage.setItem(TOKEN_KEY, r.data.access_token);
      await qc.invalidateQueries();
      toast.success('Password updated');
      router.replace('/dashboard');
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  return (
    <AuthFrame>
      <form onSubmit={submit} className="flex w-full max-w-[380px] flex-col gap-[18px]" noValidate>
        {forced && (
          <Note tone="amber" icon={<KeyRound />}>
            You signed in with a <b>temporary password</b>. Choose your own to continue.
          </Note>
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em]">{forced ? 'Choose your password' : 'Change password'}</h1>
          <p className="text-[14px] text-ink-2">{me.data ? `Signed in as ${me.data.email}` : 'Enter your current password and a new one.'}</p>
        </div>
        {error && <Note tone="red">{error}</Note>}
        <Field label={forced ? 'Temporary password' : 'Current password'} error={formState.errors.current_password?.message}>
          {(id) => <Input id={id} size="lg" type="password" autoComplete="current-password" icon={<Lock />} {...register('current_password')} />}
        </Field>
        <Field
          label="New password"
          error={formState.errors.new_password?.message}
          hint={
            <span className="flex flex-col gap-1.5">
              <span className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <i key={i} className="block h-1 flex-1 rounded" style={{ background: i <= score ? (score < 3 ? '#d97706' : '#16a34a') : 'var(--line)' }} />
                ))}
              </span>
              8 to 72 characters
            </span>
          }
        >
          {(id) => <Input id={id} size="lg" type="password" autoComplete="new-password" icon={<Lock />} {...register('new_password')} />}
        </Field>
        <Field label="Confirm new password" error={formState.errors.confirm?.message}>
          {(id) => <Input id={id} size="lg" type="password" autoComplete="new-password" icon={<Lock />} {...register('confirm')} />}
        </Field>
        <Button type="submit" variant="primary" size="lg" className="h-10" loading={formState.isSubmitting}>
          Save password
        </Button>
        {!forced && (
          <Button variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        )}
      </form>
    </AuthFrame>
  );
}
