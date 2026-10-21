import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '../../hooks/data';
import { label } from '../../types';
import { Button } from '../ui/button';
import { Badge } from '../ui/shared';

/** The signed-in person at the foot of the sidebar, with their account menu. */
export default function SidebarProfile() {
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState({ left: 0, bottom: 0 });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        (e instanceof KeyboardEvent && e.key === 'Escape') ||
        (e instanceof MouseEvent && !ref.current?.contains(e.target as Node))
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  const user = me.data;
  const name = user ? `${user.first_name} ${user.last_name}` : '';
  return (
    <div className="sidebar-profile" ref={ref}>
      <button
        className="profile-button"
        onClick={(e) => {
          // Opens beside the sidebar so its scrolling and narrow width never clip the menu.
          const sidebar = e.currentTarget
            .closest('aside')!
            .getBoundingClientRect();
          const button = e.currentTarget.getBoundingClientRect();
          setPlace({
            left: sidebar.right + 8,
            bottom: window.innerHeight - button.bottom,
          });
          setOpen(!open);
        }}
        aria-label="Profile menu"
        aria-expanded={open}
        title={name}
      >
        <div className="profile-avatar" aria-hidden>
          {user ? `${user.first_name[0]}${user.last_name[0]}` : ''}
        </div>
        <span className="profile-text">
          <strong>{name}</strong>
          <small>{user && label(user.role)}</small>
        </span>
      </button>
      {open && user && (
        <div
          className="profile-menu"
          role="dialog"
          aria-label="Account"
          style={place}
        >
          <strong>{name}</strong>
          <Badge value={user.role} />
          <p>{user.email}</p>
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false);
              nav('/change-password');
            }}
          >
            Change password
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              localStorage.removeItem('trackly_token');
              qc.clear();
              nav('/login');
            }}
          >
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
