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
export interface TestStep {
  id?: number;
  step_number: number;
  action: string;
  expected_result: string;
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
  status: string;
  steps: TestStep[];
  created_at: string;
  updated_at: string;
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
