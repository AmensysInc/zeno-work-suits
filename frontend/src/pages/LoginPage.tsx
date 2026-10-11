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
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});
export default function LoginPage() {
  const [registering, setRegistering] = useState(false);
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
        <h1>{registering ? 'Create your account' : 'Welcome back'}</h1>
        <p>Keep your team’s work moving forward.</p>
        <form
          onSubmit={handleSubmit(async (data) => {
            setError('');
            try {
              const r = await api.post(
                `/auth/${registering ? 'register' : 'login'}`,
                data,
              );
              localStorage.setItem('trackly_token', r.data.access_token);
              nav('/dashboard');
            } catch (e) {
              setError(errorMessage(e));
            }
          })}
        >
          {registering && (
            <div className="form-grid">
              <Field label="First name">
                <input required {...register('first_name')} />
              </Field>
              <Field label="Last name">
                <input required {...register('last_name')} />
              </Field>
            </div>
          )}
          <Field label="Email">
            <input type="email" autoComplete="email" {...register('email')} />
          </Field>
          <Field label="Password">
            <input
              type="password"
              autoComplete={registering ? 'new-password' : 'current-password'}
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
            {isSubmitting
              ? 'Please wait…'
              : registering
                ? 'Create account'
                : 'Sign in'}
          </Button>
        </form>
        <Button
          variant="ghost"
          onClick={() => {
            setRegistering(!registering);
            setError('');
          }}
        >
          {registering
            ? 'Already have an account? Sign in'
            : 'New to Zeno Work Suite? Create an account'}
        </Button>
      </div>
    </div>
  );
}
