'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, KeyRound, MoreHorizontal, Power, Search, UserPlus } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useData, useMe } from '@/hooks/data';
import { label, roles, type AdminUser, type IssuedLogin, type Role } from '@/types';
import { PageBar, PageBody } from '@/components/layout/page';
import { Avatar, Badge, Card, Note, State } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox, Menu, Segmented } from '@/components/ui/controls';
import { Table, Td, Th, Tr } from '@/components/ui/table';

const schema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(80),
  last_name: z.string().trim().min(1, 'Last name is required').max(80),
  email: z.string().email('Enter a valid email'),
  role: z.enum(roles),
  send_email: z.boolean(),
});
type Form = z.infer<typeof schema>;

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Never');
const roleOptions = roles.map((r) => ({ value: r, label: label(r) }));

function Credentials({ issued }: { issued: IssuedLogin }) {
  const url = `${window.location.origin}/login`;
  const text =
    `Your Zeno TeamSuite account\n` +
    `Sign in: ${url}\n` +
    `Email: ${issued.user.email}\n` +
    `Temporary password: ${issued.temporary_password}\n` +
    `You'll be asked to choose your own password when you sign in.`;
  return (
    <div className="flex flex-col gap-3">
      <Note tone={issued.email_sent ? 'green' : 'amber'}>
        {issued.email_sent
          ? `We emailed these sign-in details to ${issued.user.email}. You can also copy them below.`
          : `Share these sign-in details with ${issued.user.first_name}. The temporary password is shown only once.`}
      </Note>
      <pre className="whitespace-pre-wrap break-all rounded-lg border border-line bg-subtle p-3 font-mono text-[12.5px]">{text}</pre>
      <div className="flex justify-end">
        <Button
          variant="primary"
          icon={<Copy />}
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

export default function AdminUsersPage() {
  const me = useMe();
  const router = useRouter();
  const users = useData<AdminUser[]>('/admin/users', !!me.data?.is_admin);
  const settings = useData<{ email_configured: boolean }>('/admin/settings', !!me.data?.is_admin);
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [issued, setIssued] = useState<{ login: IssuedLogin; reset: boolean } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Role>('all');
  const emailOn = !!settings.data?.email_configured;
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { role: 'EMPLOYEE', send_email: true } });
  const notAdmin = !!me.data && !me.data.is_admin;
  useEffect(() => {
    if (notAdmin) router.replace('/dashboard');
  }, [notAdmin, router]);
  if (notAdmin) return null;

  const act = async (user: AdminUser, run: () => Promise<unknown>, done: string) => {
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
        const r = await api.post<IssuedLogin>(`/admin/users/${user.id}/reset-password`, { send_email: emailOn });
        setIssued({ login: r.data, reset: true });
      },
      'Temporary password created',
    );
  const update = (user: AdminUser, body: Partial<AdminUser>, done: string) => act(user, () => api.patch(`/admin/users/${user.id}`, body), done);
  const closeAdd = () => {
    setAdding(false);
    reset();
  };
  const list = users.data ?? [];
  const shown = list.filter((u) => (filter === 'all' || u.role === filter) && `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <>
      <PageBar
        crumbs={['People']}
        actions={
          <Button variant="primary" icon={<UserPlus />} onClick={() => setAdding(true)}>
            Add person
          </Button>
        }
      />
      <PageBody>
        <div className="flex flex-col gap-4">
          <p className="max-w-3xl text-[13px] text-ink-2">
            Create accounts and send sign-in details. Admins can open every project. Managers run the projects they own. Employees work inside the projects they belong to.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input size="sm" icon={<Search />} aria-label="Search people" placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
            <Segmented<'all' | Role>
              value={filter}
              onChange={setFilter}
              items={[{ key: 'all', label: `All · ${list.length}` }, ...roles.map((r) => ({ key: r, label: `${label(r)} · ${list.filter((u) => u.role === r).length}` }))]}
            />
          </div>
          <Card className="overflow-hidden">
            <State loading={users.isLoading} error={users.error} empty={!users.isLoading && !shown.length} emptyText={list.length ? 'Nobody matches this search.' : undefined} />
            {!!shown.length && (
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th className="w-40">Role</Th>
                    <Th className="w-28">Status</Th>
                    <Th className="w-48">Last sign-in</Th>
                    <Th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((u) => {
                    const self = u.id === me.data?.id;
                    return (
                      <Tr key={u.id}>
                        <Td>
                          <span className="flex items-center gap-2.5">
                            <Avatar user={u} size={28} />
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate font-medium">
                                {u.first_name} {u.last_name}
                                {self && <span className="font-normal text-ink-3"> (you)</span>}
                              </span>
                              <span className="truncate text-xs text-ink-3">{u.email}</span>
                            </span>
                          </span>
                        </Td>
                        <Td>
                          {self ? (
                            <Badge value={u.role} />
                          ) : (
                            <Select<Role> size="sm" className="w-32" aria-label={`Role for ${u.first_name} ${u.last_name}`} value={u.role} disabled={busy === u.id} onChange={(v) => update(u, { role: v }, 'Role updated')} options={roleOptions} />
                          )}
                        </Td>
                        <Td>{!u.is_active ? <Badge value="DISABLED" dot>Disabled</Badge> : u.must_change_password ? <Badge value="INVITED" dot>Invited</Badge> : <Badge value="ACTIVE" dot>Active</Badge>}</Td>
                        <Td className="whitespace-nowrap text-[12.5px] text-ink-2">{when(u.last_login_at)}</Td>
                        <Td>
                          <Menu
                            trigger={
                              <button aria-label={`Actions for ${u.first_name}`} disabled={busy === u.id} className="rounded p-1 text-ink-3 hover:bg-hover hover:text-ink disabled:opacity-50">
                                <MoreHorizontal className="size-4" />
                              </button>
                            }
                            items={[
                              { label: 'Reset password', icon: <KeyRound />, onSelect: () => resetPassword(u) },
                              ...(!self ? [{ label: u.is_active ? 'Disable' : 'Enable', icon: <Power />, danger: u.is_active, onSelect: () => update(u, { is_active: !u.is_active }, u.is_active ? 'User disabled' : 'User enabled') }] : []),
                            ]}
                          />
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </PageBody>

      {adding && (
        <Dialog
          title="Add person"
          onClose={closeAdd}
          footer={
            <>
              <Button onClick={closeAdd}>Cancel</Button>
              <Button variant="primary" type="submit" form="add-person" loading={isSubmitting}>
                Create user
              </Button>
            </>
          }
        >
          <form
            id="add-person"
            className="flex flex-col gap-3.5"
            onSubmit={handleSubmit(async (data) => {
              try {
                const r = await api.post<IssuedLogin>('/admin/users', { ...data, send_email: emailOn && data.send_email });
                await qc.invalidateQueries({ queryKey: ['/admin/users'] });
                closeAdd();
                setIssued({ login: r.data, reset: false });
              } catch (e) {
                toast.error(errorMessage(e));
              }
            })}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" error={errors.first_name?.message}>
                {(id) => <Input id={id} autoFocus {...register('first_name')} />}
              </Field>
              <Field label="Last name" error={errors.last_name?.message}>
                {(id) => <Input id={id} {...register('last_name')} />}
              </Field>
            </div>
            <Field label="Email" error={errors.email?.message}>
              {(id) => <Input id={id} type="email" {...register('email')} />}
            </Field>
            <Field label="Role">{(id) => <Controller control={control} name="role" render={({ field }) => <Select<Role> id={id} value={field.value} onChange={field.onChange} options={roleOptions} />} />}</Field>
            <Controller
              control={control}
              name="send_email"
              render={({ field }) => <Checkbox disabled={!emailOn} checked={emailOn && field.value} onChange={field.onChange} label="Email the sign-in details to this user" />}
            />
            {!emailOn && <Note>Email isn’t set up yet, so you’ll copy the sign-in details on the next screen and share them yourself.</Note>}
          </form>
        </Dialog>
      )}
      {issued && (
        <Dialog title={issued.reset ? 'New temporary password' : 'User created'} onClose={() => setIssued(null)}>
          <Credentials issued={issued.login} />
        </Dialog>
      )}
    </>
  );
}
