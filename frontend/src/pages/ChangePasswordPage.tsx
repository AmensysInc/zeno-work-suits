import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, errorMessage } from '../services/api';
import { useMe } from '../hooks/data';
import { Button } from '../components/ui/button';
import { Field } from '../components/ui/shared';
const schema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    new_password: z.string().min(8, 'Use at least 8 characters').max(72),
    confirm: z.string(),
  })
  .refine((d) => d.new_password === d.confirm, {
    message: 'The new passwords don’t match',
    path: ['confirm'],
  });
// Shown on first sign-in with a temporary password, and from the profile menu.
export default function ChangePasswordPage() {
  const [error, setError] = useState('');
  const nav = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const forced = !!me.data?.must_change_password;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand">
          <span className="logo" />
          Zeno Work Suite
        </div>
        <h1>{forced ? 'Choose your password' : 'Change password'}</h1>
        <p>
          {forced
            ? 'You signed in with a temporary password. Pick your own to continue.'
            : 'Enter your current password and a new one.'}
        </p>
        <form
          onSubmit={handleSubmit(async ({ current_password, new_password }) => {
            setError('');
            try {
              await api.post('/auth/change-password', { current_password, new_password });
              await qc.invalidateQueries();
              toast.success('Password updated');
              nav('/dashboard');
            } catch (e) {
              setError(errorMessage(e));
            }
          })}
        >
          <Field label={forced ? 'Temporary password' : 'Current password'}>
            <input type="password" autoComplete="current-password" {...register('current_password')} />
          </Field>
          <Field label="New password">
            <input type="password" autoComplete="new-password" {...register('new_password')} />
          </Field>
          <Field label="Confirm new password">
            <input type="password" autoComplete="new-password" {...register('confirm')} />
          </Field>
          {Object.values(errors).map((e, i) => (
            <p className="error" key={i}>
              {e.message}
            </p>
          ))}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait…' : 'Save password'}
          </Button>
        </form>
        {!forced && (
          <Button variant="ghost" onClick={() => nav(-1)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
