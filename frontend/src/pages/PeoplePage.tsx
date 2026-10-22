import { useState } from 'react';
import { Avatar, Card, Typography } from 'antd';
import { UserAddOutlined } from '@ant-design/icons';
import { useData, useMe, useSave } from '../hooks/data';
import { Badge, PageHeader, State } from '../components/ui/shared';
import { Button } from '../components/ui/button';
import { Select, labelled } from '../components/ui/form';
import AddPersonModal from '../components/people/AddPersonModal';
import { roles, type Role, type User } from '../types';

function PersonRow({ user }: { user: User }) {
  const save = useSave<{ role: Role }>(
    `/auth/users/${user.id}`,
    'patch',
    'Role updated',
  );
  return (
    <div className="list-row">
      <Avatar size={32} className="mini-avatar">
        {user.first_name[0]}
        {user.last_name[0]}
      </Avatar>
      <div className="member-name">
        <Typography.Text strong>
          {user.first_name} {user.last_name}
        </Typography.Text>
        <Typography.Text type="secondary">{user.email}</Typography.Text>
      </div>
      <Badge value={user.role} />
      <Select
        className="role-select"
        aria-label={`Role for ${user.first_name} ${user.last_name}`}
        value={user.role}
        disabled={save.isPending}
        onChange={(v) => save.mutate({ role: v as Role })}
        options={labelled(roles)}
      />
    </div>
  );
}

export default function PeoplePage() {
  const me = useMe();
  const admin = me.data?.role === 'ADMIN';
  const users = useData<User[]>('/auth/users', admin);
  const [adding, setAdding] = useState(false);
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
      >
        <Button icon={<UserAddOutlined />} onClick={() => setAdding(true)}>
          Add person
        </Button>
      </PageHeader>
      {adding && <AddPersonModal onClose={() => setAdding(false)} />}
      <Card className="card">
        <State
          loading={users.isLoading}
          error={users.error}
          empty={users.data?.length === 0}
        />
        {users.data?.map((user) => (
          <PersonRow key={user.id} user={user} />
        ))}
      </Card>
    </>
  );
}
