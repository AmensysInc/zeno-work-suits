import { useData, useMe, useSave } from '../hooks/data';
import { Badge, PageHeader, State } from '../components/ui/shared';
import { label, roles, type Role, type User } from '../types';

function PersonRow({ user }: { user: User }) {
  const save = useSave<{ role: Role }>(
    `/auth/users/${user.id}`,
    'patch',
    'Role updated',
  );
  return (
    <div className="list-row">
      <span className="mini-avatar">
        {user.first_name[0]}
        {user.last_name[0]}
      </span>
      <strong>
        {user.first_name} {user.last_name}
      </strong>
      <span className="muted">{user.email}</span>
      <Badge value={user.role} />
      <select
        aria-label={`Role for ${user.first_name} ${user.last_name}`}
        value={user.role}
        disabled={save.isPending}
        onChange={(e) => save.mutate({ role: e.target.value as Role })}
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {label(role)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PeoplePage() {
  const me = useMe();
  const admin = me.data?.role === 'ADMIN';
  const users = useData<User[]>('/auth/users', admin);
  if (!me.data) return <State loading={me.isLoading} error={me.error} />;
  if (!admin)
    return (
      <PageHeader
        title="People"
        description="Only an admin can view people and change roles."
      />
    );
  return (
    <>
      <PageHeader
        title="People"
        description="Admin can open every project. Managers run the projects they own. Employees work inside the projects they belong to."
      />
      <section className="card">
        <State
          loading={users.isLoading}
          error={users.error}
          empty={users.data?.length === 0}
        />
        {users.data?.map((user) => (
          <PersonRow key={user.id} user={user} />
        ))}
      </section>
    </>
  );
}
