import type { Execution, Issue, TestCase, TraceStory, User } from '@/types';

export const fullName = (u?: Pick<User, 'first_name' | 'last_name'> | null) =>
  u ? `${u.first_name} ${u.last_name}` : 'Unassigned';

export const isOpen = (status: Issue['status']) => status !== 'DONE';

/** Prefills a bug from a failed test, including what actually happened in the run. */
export function bugFromRun(tc: TestCase, run?: Execution): Partial<Issue> {
  const steps = run?.steps ?? tc.steps;
  const lines = steps.map((s) => {
    const result =
      'status' in s && s.status !== 'NOT_RUN' ? ` [${s.status}]` : '';
    const actual =
      'actual_result' in s && s.actual_result
        ? `\n   Actual: ${s.actual_result}`
        : '';
    const data = s.test_data ? `\n   Data: ${s.test_data}` : '';
    return `${s.step_number}. ${s.action}${result}${data}\n   Expected: ${s.expected_result || '—'}${actual}`;
  });
  return {
    project_id: tc.project_id,
    issue_type: 'BUG',
    priority: tc.priority === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
    summary: `Failed: ${tc.title}`,
    description: [
      `Found by ${tc.test_case_key} — ${tc.title}`,
      run &&
        `Run on ${run.executed_on} by ${fullName(run.tester)}${run.environment ? ` in ${run.environment}` : ''}`,
      tc.preconditions && `Preconditions: ${tc.preconditions}`,
      `Steps:\n${lines.join('\n')}`,
      `Expected: ${tc.expected_result || '—'}`,
      run?.actual_result && `Actual: ${run.actual_result}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    related_issue_id: tc.issue_id,
    related_test_case_id: tc.id,
    related_execution_id: run?.id ?? null,
  };
}

export type Health = 'READY' | 'AT_RISK' | 'GAP' | 'NOT_RUN';
export const healthLabel: Record<Health, string> = {
  READY: 'Ready',
  AT_RISK: 'At risk',
  GAP: 'Coverage gap',
  NOT_RUN: 'Awaiting tests',
};

/** Gap: untested story or criterion. At risk: failing tests or open bugs. */
export function storyHealth(story: TraceStory): Health {
  if (
    !story.test_cases.length ||
    story.criteria.some((c) => !c.test_case_ids.length)
  )
    return 'GAP';
  if (
    story.test_cases.some((t) => ['FAILED', 'BLOCKED'].includes(t.status)) ||
    story.bugs.some((b) => isOpen(b.status))
  )
    return 'AT_RISK';
  if (story.test_cases.some((t) => t.status === 'NOT_RUN')) return 'NOT_RUN';
  return 'READY';
}

export const percent = (part: number, total: number) =>
  total ? Math.round((part / total) * 100) : 0;
