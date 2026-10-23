import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Popover, Space, Typography } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useMe } from '../../hooks/data';
import { label } from '../../types';
import { Badge } from '../ui/shared';

/** The signed-in person at the foot of the sidebar, with their account menu. */
export default function SidebarProfile({ collapsed }: { collapsed: boolean }) {
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const user = me.data;
  const name = user ? `${user.first_name} ${user.last_name}` : '';
  const initials = user ? `${user.first_name[0]}${user.last_name[0]}` : '';
  return (
    <div className="sidebar-profile">
      <Popover
        trigger="click"
        placement="rightBottom"
        content={
          user && (
            <div className="profile-menu" aria-label="Account">
              <Space>
                <Typography.Text strong>{name}</Typography.Text>
                <Badge value={user.role} />
              </Space>
              <Typography.Paragraph type="secondary">
                {user.email}
              </Typography.Paragraph>
              <Button
                block
                icon={<LogoutOutlined />}
                onClick={() => {
                  localStorage.removeItem('trackly_token');
                  qc.clear();
                  nav('/login');
                }}
              >
                Sign out
              </Button>
            </div>
          )
        }
      >
        <button
          className="profile-button"
          aria-label="Profile menu"
          title={name}
        >
          <Avatar size={32} className="profile-avatar">
            {initials}
          </Avatar>
          {!collapsed && (
            <span className="profile-text">
              <strong>{name}</strong>
              <small>{user && label(user.role)}</small>
            </span>
          )}
        </button>
      </Popover>
    </div>
  );
}
