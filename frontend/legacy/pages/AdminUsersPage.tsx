import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { api, errorMessage } from '../services/api';
import { useData, useMe } from '../hooks/data';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/dialog';
import { Badge, Field, PageHeader, State } from '../components/ui/shared';
import {
  label,
  roles,
  type AdminUser,
  type IssuedLogin,
  type Role,
} from '../types';

const schema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(80),
  last_name: z.string().trim().min(1, 'Last name is required').max(80),
  email: z.string().email('Enter a valid email'),
  role: z.enum(roles),
  send_email: z.boolean(),
});
type Form = z.infer<typeof schema>;

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Never';

export default function AdminUsersPage() {
  const me = useMe();
  const users = useData<AdminUser[]>('/admin/users', !!me.data?.is_admin);
  const settings = useData<{ email_configured: boolean }>(
    '/admin/settings',
    !!me.data?.is_admin,
  );
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<{
    login: IssuedLogin;
    reset: boolean;
  } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const emailOn = !!settings.data?.email_configured;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'EMPLOYEE', send_email: true },
  });

  if (me.data && !me.data.is_admin) return <Navigate to="/dashboard" replace />;

  const act = async (
    user: AdminUser,
    run: () => Promise<unknown>,
    done: string,
  ) => {
    setBusy(user.id);
    try {
      await run();
      await qc.invalidateQueries({ queryKey: ['/admin/users'] });
      toast.success(done);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const resetPassword = (user: AdminUser) =>
    act(
      user,
      async () => {
        const r = await api.post<IssuedLogin>(
          `/admin/users/${user.id}/reset-password`,
          {
            send_email: emailOn,
          },
        );
        setIssued({ login: r.data, reset: true });
      },
      'Temporary password created',
    );

  const update = (user: AdminUser, body: Partial<AdminUser>, done: string) =>
    act(user, () => api.patch(`/admin/users/${user.id}`, body), done);

  const list = users.data ?? [];
  return (
    <>
      <PageHeader
        title="People"
        description="Create accounts and send sign-in details. Admins can open every project. Managers run the projects they own. Employees work inside the projects they belong to."
      >
        <Button onClick={() => setAdding(true)}>+ Add person</Button>
      </PageHeader>

      <div className="card">
        <State
          loading={users.isLoading}
          error={users.error}
          empty={!users.isLoading && !list.length}
        />
        {!!list.length && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last sign-in</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => {
                  const self = u.id === me.data?.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        {u.first_name} {u.last_name}
                        {self && <span className="muted"> (you)</span>}
                      </td>
                      <td className="muted">{u.email}</td>
                      <td>
                        {self ? (
                          <Badge value={u.role} />
                        ) : (
                          <select
                            className="inline-select"
                            aria-label={`Role for ${u.first_name} ${u.last_name}`}
                            value={u.role}
                            disabled={busy === u.id}
                            onChange={(e) =>
                              update(
                                u,
                                { role: e.target.value as Role },
                                'Role updated',
                              )
                            }
                          >
                            {roles.map((role) => (
                              <option key={role} value={role}>
                                {label(role)}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${u.is_active ? 'badge-active' : 'badge-blocked'}`}
                        >
                          {!u.is_active
                            ? 'Disabled'
                            : u.must_change_password
                              ? 'Invited'
                              : 'Active'}
                        </span>
                      </td>
                      <td className="muted">{when(u.last_login_at)}</td>
                      <td>
                        <div className="actions">
                          <Button
                            variant="outline"
                            disabled={busy === u.id}
                            onClick={() => resetPassword(u)}
                          >
                            Reset password
                          </Button>
                          {!self && (
                            <Button
                              variant={u.is_active ? 'destructive' : 'ghost'}
                              disabled={busy === u.id}
                              onClick={() =>
                                update(
                                  u,
                                  { is_active: !u.is_active },
                                  u.is_active
                                    ? 'User disabled'
                                    : 'User enabled',
                                )
                              }
                            >
                              {u.is_active ? 'Disable' : 'Enable'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={adding}
        onClose={() => {
          setAdding(false);
          reset();
        }}
        title="Add person"
      >
        <form
          onSubmit={handleSubmit(async (data) => {
            try {
              const r = await api.post<IssuedLogin>('/admin/users', {
                ...data,
                send_email: emailOn && data.send_email,
              });
              await qc.invalidateQueries({ queryKey: ['/admin/users'] });
              setAdding(false);
              reset();
              setIssued({ login: r.data, reset: false });
            } catch (e) {
              toast.error(errorMessage(e));
            }
          })}
        >
          <div className="form-grid">
            <Field label="First name">
              <input autoFocus {...register('first_name')} />
            </Field>
            <Field label="Last name">
              <input {...register('last_name')} />
            </Field>
          </div>
          <Field label="Email">
            <input type="email" {...register('email')} />
          </Field>
          <Field label="Role">
            <select {...register('role')}>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {label(role)}
                </option>
              ))}
            </select>
          </Field>
          <label className="check">
            <input
              type="checkbox"
              disabled={!emailOn}
              {...register('send_email')}
            />{' '}
            Email the sign-in details to this user
          </label>
          {!emailOn && (
            <p className="muted">
              Email isn’t set up yet, so you’ll copy the sign-in details on the
              next screen and share them yourself.
            </p>
          )}
          {Object.values(errors).map((e, i) => (
            <p className="error" key={i}>
              {e.message}
            </p>
          ))}
          <div className="actions">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create user'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!issued}
        onClose={() => setIssued(null)}
        title={issued?.reset ? 'New temporary password' : 'User created'}
      >
        {issued && <Credentials issued={issued.login} />}
      </Modal>
    </>
  );
}

function Credentials({ issued }: { issued: IssuedLogin }) {
  const url = `${window.location.origin}/login`;
  const text =
    `Your Zeno TeamSuite account\n` +
    `Sign in: ${url}\n` +
    `Email: ${issued.user.email}\n` +
    `Temporary password: ${issued.temporary_password}\n` +
    `You'll be asked to choose your own password when you sign in.`;
  return (
    <div className="credentials">
      <p>
        {issued.email_sent
          ? `We emailed these sign-in details to ${issued.user.email}. You can also copy them below.`
          : `Share these sign-in details with ${issued.user.first_name}. The temporary password is shown only once.`}
      </p>
      <pre className="credentials-box">{text}</pre>
      <div className="actions">
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast.success('Copied');
            } catch {
              toast.error('Copy failed. Select the text and copy it manually.');
            }
          }}
        >
          Copy sign-in details
        </Button>
      </div>
    </div>
  );
}
