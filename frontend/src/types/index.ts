export const roles = ['ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
export type Role = (typeof roles)[number];
export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  avatar_url: string | null;
  is_admin?: boolean;
  must_change_password?: boolean;
}
export interface AdminUser extends User {
  is_admin: boolean;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}
export interface IssuedLogin {
  user: AdminUser;
  temporary_password: string;
  email_sent: boolean;
}
/** Admins run the whole workspace. Managers can open new projects. */
export const canCreateProjects = (role?: string) =>
  role === 'ADMIN' || role === 'MANAGER';
/** Admins manage every project. Managers manage the projects they own. */
export const canManageProject = (
  me: Pick<User, 'id' | 'role'> | undefined,
  project: { owner_id: number },
) =>
  !!me &&
  (me.role === 'ADMIN' ||
    (me.role === 'MANAGER' && me.id === project.owner_id));
export const projectRoles = [
  'LEAD',
  'DEVELOPER',
  'DESIGNER',
  'TESTER',
  'BUSINESS_ANALYST',
  'DEVOPS',
] as const;
export type ProjectRole = (typeof projectRoles)[number];
export interface TeamMember {
  user: User;
  role: ProjectRole;
}
export interface Project {
  id: number;
  key: string;
  name: string;
  description: string;
  owner_id: number;
  status: string;
  board_type: 'SCRUM' | 'KANBAN';
  start_date: string | null;
  end_date: string | null;
  code_freeze_date: string | null;
  testing_date: string | null;
  github_repo: string;
  created_at: string;
  updated_at: string;
  members: User[];
  team: TeamMember[];
}
export interface GitHubRepo {
  full_name: string;
  html_url: string;
  description: string;
  private: boolean;
  default_branch: string;
  linked_projects: string[];
}
export interface GitHubBranch {
  name: string;
  sha: string;
  protected: boolean;
}
export interface GitHubBranches {
  repository: string;
  html_url: string;
  default_branch: string;
  can_merge: boolean;
  branches: GitHubBranch[];
}
export interface GitHubPull {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  draft: boolean;
  head: string;
  base: string;
  author: string;
  html_url: string;
  created_at: string;
  updated_at: string;
}
export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  html_url: string;
}
/** "owner/name" for a linked https://github.com/owner/name URL. */
export const repoName = (url: string) =>
  url.match(/^https:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/)?.[1];
export const generatorOutputs = ['USER_STORIES', 'TEST_CASES', 'BOTH'] as const;
export type GeneratorOutput = (typeof generatorOutputs)[number];
export const generatorCoverage = [
  'POSITIVE',
  'NEGATIVE',
  'BOUNDARY',
  'VALIDATION',
] as const;
export type GeneratorCoverage = (typeof generatorCoverage)[number];
/** A folder of the default branch, or what a branch, pull request or commit changed. */
export type GeneratorSourceKind = 'DEFAULT' | 'BRANCH' | 'PULL' | 'COMMIT';
export interface AiSource {
  repository: string;
  module_path: string;
  source_commit: string;
  source_kind?: GeneratorSourceKind;
  source_ref?: string;
  generator?: string;
}
export interface GeneratorModule {
  path: string;
  file_count: number;
}
export interface GeneratedStep {
  action: string;
  test_data: string;
  expected_result: string;
}
export interface GeneratedTestCase {
  title: string;
  test_type: string;
  priority: string;
  preconditions: string;
  test_data: string;
  expected_result: string;
  steps: GeneratedStep[];
  /** Indexes of the story's acceptance criteria this test proves. */
  criteria: number[];
}
export interface GeneratedStory {
  title: string;
  description: string;
  priority: string;
  story_points: number;
  acceptance_criteria: string[];
  test_cases: GeneratedTestCase[];
}
export interface GeneratedDraft {
  project_id: number;
  repository: string;
  module_path: string;
  source_commit: string;
  source_kind: GeneratorSourceKind;
  source_ref: string;
  output_type: GeneratorOutput;
  coverage: GeneratorCoverage[];
  user_stories: GeneratedStory[];
  notes: string[];
}
export interface GeneratorSuggestions {
  source_commit: string;
  current_commit: string;
  stale_story_ids: number[];
  stale_test_case_ids: number[];
  message: string;
}
export const projectDates = [
  ['start_date', 'Start date'],
  ['end_date', 'End date'],
  ['code_freeze_date', 'Code freeze'],
  ['testing_date', 'Testing'],
] as const;
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
  ai_source?: AiSource | null;
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
  ai_source?: AiSource | null;
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
export interface ChatMessage {
  id: number;
  project_id: number;
  user_id: number;
  body: string;
  created_at: string;
  updated_at: string;
  user: User;
}
export const automationActions = [
  'NOTIFY_REPORTER',
  'NOTIFY_ASSIGNEE',
  'CREATE_BUG',
] as const;
export type AutomationAction = (typeof automationActions)[number];
export interface AutomationRule {
  id: number;
  name: string;
  owner_id: number;
  project_id: number | null;
  trigger: 'STATUS_CHANGED';
  to_status: (typeof statuses)[number];
  action: AutomationAction;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  owner: User;
  project: Project | null;
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
