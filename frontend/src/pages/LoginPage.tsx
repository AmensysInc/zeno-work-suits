import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import { Button } from '../components/ui/button';
import { Field } from '../components/ui/shared';
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});
// Accounts are created by an administrator, so there is no sign-up here.
export default function LoginPage() {
  const [error, setError] = useState('');
  const nav = useNavigate();
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
        <h1>Welcome back</h1>
        <p>Keep your team’s work moving forward.</p>
        <form
          onSubmit={handleSubmit(async (data) => {
            setError('');
            try {
              const r = await api.post('/auth/login', data);
              localStorage.setItem('trackly_token', r.data.access_token);
              const me = await api.get('/auth/me');
              nav(me.data.must_change_password ? '/change-password' : '/dashboard');
            } catch (e) {
              setError(errorMessage(e));
            }
          })}
        >
          <Field label="Email">
            <input type="email" autoComplete="email" {...register('email')} />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
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
            {isSubmitting ? 'Please wait…' : 'Sign in'}
          </Button>
        </form>
        <p className="muted">
          Need an account or forgot your password? Ask your Zeno Work Suite
          administrator.
        </p>
      </div>
    </div>
  );
}
