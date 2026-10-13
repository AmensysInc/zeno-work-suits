export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
}
export interface Project {
  id: number;
  key: string;
  name: string;
  description: string;
  owner_id: number;
  status: string;
  board_type: 'SCRUM' | 'KANBAN';
  created_at: string;
  updated_at: string;
  members: User[];
}
export const issueTypes = ['EPIC', 'STORY', 'TASK', 'BUG', 'SUBTASK'] as const;
export const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const statuses = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'CODE_REVIEW',
  'TESTING',
  'DONE',
] as const;
export interface Issue {
  id: number;
  project_id: number;
  issue_key: string;
  issue_type: (typeof issueTypes)[number];
  summary: string;
  description: string;
  status: (typeof statuses)[number];
  priority: (typeof priorities)[number];
  assignee_id: number | null;
  reporter_id: number;
  parent_issue_id: number | null;
  epic_id: number | null;
  sprint_id: number | null;
  story_points: number;
  labels: string[];
  order_index: number;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  related_issue_id: number | null;
  related_test_case_id: number | null;
  related_execution_id: number | null;
  assignee: User | null;
  reporter: User;
}
export interface Sprint {
  id: number;
  project_id: number;
  name: string;
  goal: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  start_date: string | null;
  end_date: string | null;
  capacity: number;
}
export interface Criterion {
  id: number;
  issue_id: number;
  description: string;
  order_index: number;
  completed: boolean;
}
export const testTypes = [
  'FUNCTIONAL',
  'REGRESSION',
  'INTEGRATION',
  'UI',
  'API',
] as const;
export const testStatuses = [
  'NOT_RUN',
  'PASSED',
  'FAILED',
  'BLOCKED',
  'SKIPPED',
] as const;
export const runStatuses = ['PASSED', 'FAILED', 'BLOCKED', 'SKIPPED'] as const;
export const stepStatuses = ['NOT_RUN', 'PASSED', 'FAILED', 'BLOCKED'] as const;
export type TestStatus = (typeof testStatuses)[number];
export type RunStatus = (typeof runStatuses)[number];
export type StepStatus = (typeof stepStatuses)[number];
export interface TestStep {
  id?: number;
  step_number: number;
  action: string;
  test_data: string;
  expected_result: string;
  shared_step_id: number | null;
}
export interface TestCase {
  id: number;
  project_id: number;
  issue_id: number;
  test_case_key: string;
  title: string;
  test_type: string;
  priority: string;
  preconditions: string;
  expected_result: string;
  test_data: string;
  status: TestStatus;
  steps: TestStep[];
  criterion_ids: number[];
  last_executed_on: string | null;
  execution_count: number;
  created_at: string;
  updated_at: string;
}
export interface SharedStep {
  id: number;
  project_id: number;
  title: string;
  action: string;
  test_data: string;
  expected_result: string;
  usage_count: number;
  updated_at: string;
}
export interface ExecutionStep {
  id: number;
  step_number: number;
  action: string;
  test_data: string;
  expected_result: string;
  actual_result: string;
  status: StepStatus;
}
export interface Execution {
  id: number;
  project_id: number;
  test_case_id: number;
  test_case_key: string;
  test_case_title: string;
  issue_id: number;
  sprint_id: number | null;
  status: RunStatus;
  actual_result: string;
  environment: string;
  tester_id: number;
  tester: User;
  executed_on: string;
  created_at: string;
  steps: ExecutionStep[];
}
type TraceUser = Pick<User, 'id' | 'first_name' | 'last_name'>;
export interface TraceIssue {
  id: number;
  issue_key: string;
  summary: string;
  status: Issue['status'];
  priority: Issue['priority'];
  related_test_case_id: number | null;
  related_execution_id: number | null;
}
export interface TraceTest {
  id: number;
  test_case_key: string;
  title: string;
  status: TestStatus;
  criterion_ids: number[];
  last_execution: {
    id: number;
    status: RunStatus;
    executed_on: string;
    tester: TraceUser;
  } | null;
}
export interface TraceStory {
  id: number;
  issue_key: string;
  summary: string;
  status: Issue['status'];
  priority: Issue['priority'];
  story_points: number;
  epic_id: number | null;
  sprint_id: number | null;
  assignee: TraceUser | null;
  criteria: {
    id: number;
    description: string;
    completed: boolean;
    test_case_ids: number[];
  }[];
  subtasks: TraceIssue[];
  test_cases: TraceTest[];
  bugs: TraceIssue[];
}
export interface Traceability {
  epics: TraceIssue[];
  stories: TraceStory[];
}
type ReportUser = Pick<User, 'id' | 'first_name' | 'last_name'>;
export interface ProjectReport {
  summary: {
    total_issues: number;
    open_issues: number;
    done_issues: number;
    total_points: number;
    done_points: number;
    open_bugs: number;
    average_velocity: number | null;
    average_lead_time_days: number | null;
  };
  by_status: { key: string; count: number }[];
  by_type: { key: string; count: number }[];
  by_priority: { key: string; count: number }[];
  velocity: {
    sprint_id: number;
    name: string;
    status: Sprint['status'];
    committed_points: number;
    completed_points: number;
    committed_issues: number;
    completed_issues: number;
  }[];
  burndown: {
    sprint_id: number;
    name: string;
    total_points: number;
    days: { date: string; remaining: number | null; ideal: number }[];
  } | null;
  workload: {
    user: ReportUser | null;
    open_issues: number;
    open_points: number;
    in_progress: number;
    done_issues: number;
  }[];
  created_vs_resolved: { week: string; created: number; resolved: number }[];
}
export interface Comment {
  id: number;
  issue_id: number;
  user_id: number;
  body: string;
  created_at: string;
  updated_at: string;
  user: User;
}
export interface Activity {
  id: number;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  user: User;
}
export const label = (s: string) =>
  s === 'TODO'
    ? 'To Do'
    : s
        .toLowerCase()
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
