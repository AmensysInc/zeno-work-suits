'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { api, clearSession, errorMessage, TOKEN_KEY } from '@/lib/api';
import { AuthFrame } from '@/components/layout/auth-frame';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Note } from '@/components/ui/display';

const schema = z.object({
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password').min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer'),
});

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  const submit = handleSubmit(async (data) => {
    setError('');
    try {
      const r = await api.post('/auth/login', data);
      // Start clean: no project or cached data left by the previous session.
      clearSession();
      qc.clear();
      localStorage.setItem(TOKEN_KEY, r.data.access_token);
      const me = await api.get('/auth/me');
      router.replace(me.data.must_change_password ? '/change-password' : '/dashboard');
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  const locked = /too many failed/i.test(error);
  return (
    <AuthFrame>
      <form onSubmit={submit} className="flex w-full max-w-[360px] flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold tracking-[-0.03em]">Welcome back</h1>
          <p className="text-[14px] text-ink-2">Sign in to pick up where your team left off.</p>
        </div>
        {error && (
          <Note tone="red" icon={locked ? <Lock /> : undefined}>
            {locked ? (
              <>
                <b>Too many failed sign-ins.</b> {error.replace(/^Too many failed sign-ins\.\s*/i, '')} Or ask an admin for a temporary password.
              </>
            ) : (
              error
            )}
          </Note>
        )}
        <Field label="Work email" error={formState.errors.email?.message}>
          {(id) => <Input id={id} size="lg" type="email" autoComplete="email" placeholder="you@company.com" icon={<Mail />} {...register('email')} />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          {(id) => (
            <Input
              id={id}
              size="lg"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              icon={<Lock />}
              suffix={
                <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="text-ink-3 hover:text-ink">
                  {show ? <EyeOff /> : <Eye />}
                </button>
              }
              {...register('password')}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" className="h-10" loading={formState.isSubmitting}>
          Sign in <ArrowRight />
        </Button>
        <div className="h-px bg-line" />
        <p className="text-center text-[12.5px] text-ink-3">Need access? Ask your workspace admin to add you.</p>
      </form>
    </AuthFrame>
  );
}
