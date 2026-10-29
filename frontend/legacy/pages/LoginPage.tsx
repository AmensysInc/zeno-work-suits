import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Avatar, Button, Form, Input, Progress, Typography } from 'antd';
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  ExperimentOutlined,
  LockOutlined,
  MailOutlined,
  ProjectOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { api, clearSession, errorMessage } from '../services/api';
interface Credentials {
  email: string;
  password: string;
}

const features = [
  {
    icon: <ProjectOutlined />,
    title: 'Sprints & boards',
    text: 'Plan sprints, rank the backlog and move work across a live board.',
  },
  {
    icon: <ExperimentOutlined />,
    title: 'Built-in QA',
    text: 'Test cases, runs, bugs and traceability from story to release.',
  },
  {
    icon: <RobotOutlined />,
    title: 'AI assistance',
    text: 'Draft stories, acceptance criteria and tests from your code.',
  },
];

/** Decorative product preview on the brand panel. */
function PreviewCard() {
  return (
    <div className="auth-preview" aria-hidden>
      <div className="auth-preview-head">
        <span className="auth-preview-dot" />
        <strong>Sprint review</strong>
        <span className="auth-preview-chip">Active</span>
      </div>
      <Progress
        percent={72}
        showInfo={false}
        strokeColor={{ from: '#8ea2f9', to: '#b69cff' }}
        railColor="rgba(255,255,255,0.15)"
      />
      <div className="auth-preview-rows">
        {['Leave request form', 'Approval workflow', 'Balance validation'].map(
          (task, i) => (
            <div className="auth-preview-row" key={task}>
              <CheckCircleFilled className={i < 2 ? 'done' : ''} />
              <span>{task}</span>
            </div>
          ),
        )}
      </div>
      <Avatar.Group size={26} className="auth-preview-team">
        {['AR', 'NK', 'SP'].map((initials, i) => (
          <Avatar key={initials} className={`auth-avatar-${i}`}>
            {initials}
          </Avatar>
        ))}
      </Avatar.Group>
    </div>
  );
}

export default function LoginPage() {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const submit = async (data: Credentials) => {
    setError('');
    setSubmitting(true);
    try {
      const r = await api.post('/auth/login', data);
      // Start clean: no project or cached data left by the previous session.
      clearSession();
      qc.clear();
      localStorage.setItem('trackly_token', r.data.access_token);
      const me = await api.get('/auth/me');
      nav(me.data.must_change_password ? '/change-password' : '/dashboard');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-glow auth-glow-1" />
        <div className="auth-glow auth-glow-2" />
        <div className="brand auth-brand-logo">
          <span className="logo">Z</span>
          Zeno TeamSuite
        </div>
        <div className="auth-pitch">
          <h1>
            Plan, build and ship
            <br />
            <span>together.</span>
          </h1>
          <p>
            One workspace for your projects, sprints, quality and code — so
            every next step is clear.
          </p>
          <ul className="auth-features">
            {features.map((f) => (
              <li key={f.title}>
                <span className="auth-feature-icon">{f.icon}</span>
                <div>
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <PreviewCard />
        <small className="auth-copyright">
          © {new Date().getFullYear()} Zeno TeamSuite
        </small>
      </aside>

      <main className="auth-panel">
        <div className="auth-form-wrap">
          <div className="brand auth-mobile-logo">
            <span className="logo">Z</span>
            Zeno TeamSuite
          </div>
          <div className="auth-heading">
            <Typography.Title level={2}>Welcome back</Typography.Title>
            <Typography.Text type="secondary">
              Sign in to pick up where your team left off.
            </Typography.Text>
          </div>
          <Form
            layout="vertical"
            requiredMark={false}
            onFinish={submit}
            className="auth-form"
            size="large"
          >
            <Form.Item
              label="Work email"
              name="email"
              rules={[
                { required: true, message: 'Enter your email' },
                { type: 'email', message: 'Enter a valid email address' },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                autoComplete="email"
                placeholder="you@company.com"
              />
            </Form.Item>
            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: true, message: 'Enter your password' },
                { min: 8, message: 'Use at least 8 characters' },
                { max: 72, message: 'Use 72 characters or fewer' },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Form.Item>
            {error && (
              <Alert type="error" showIcon role="alert" title={error} />
            )}
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
              className="auth-submit"
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
            >
              Sign in
            </Button>
          </Form>
          <p className="auth-alt">
            Need access? Ask your workspace admin to add you.
          </p>
        </div>
      </main>
    </div>
  );
}
