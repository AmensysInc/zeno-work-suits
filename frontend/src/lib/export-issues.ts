import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { label, type Issue, type Sprint } from '@/types';

const fullName = (u: { first_name: string; last_name: string } | null | undefined) =>
  u ? `${u.first_name} ${u.last_name}`.trim() : '';

function safeFilePart(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'export';
}

export function exportIssuesXlsx({
  filenameStem,
  issues,
  sprints = [],
  lookupIssues,
}: {
  filenameStem: string;
  issues: Issue[];
  sprints?: Sprint[];
  /** Full project issue list used to resolve epic/parent names when exporting a subset. */
  lookupIssues?: Issue[];
}) {
  if (!issues.length) {
    toast.error('Nothing to export');
    return;
  }

  const catalog = lookupIssues ?? issues;
  const sprintName = new Map(sprints.map((s) => [s.id, s.name]));
  const epicSummary = new Map(catalog.filter((i) => i.issue_type === 'EPIC').map((i) => [i.id, i.summary]));
  const parentKey = new Map(catalog.map((i) => [i.id, i.issue_key]));

  const rows = issues.map((i) => ({
    Key: i.issue_key,
    Type: label(i.issue_type),
    Summary: i.summary,
    Status: label(i.status),
    Priority: label(i.priority),
    Assignee: (i.assignees?.length ? i.assignees.map(fullName).join(', ') : fullName(i.assignee)) || 'Unassigned',
    Reporter: fullName(i.reporter),
    'Story points': i.story_points,
    Sprint: i.sprint_id ? (sprintName.get(i.sprint_id) ?? '') : 'Backlog',
    Epic: i.epic_id ? (epicSummary.get(i.epic_id) ?? '') : '',
    Parent: i.parent_issue_id ? (parentKey.get(i.parent_issue_id) ?? '') : '',
    Labels: i.labels.join(', '),
    Created: i.created_at,
    Updated: i.updated_at,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 12 },
    { wch: 10 },
    { wch: 40 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 24 },
    { wch: 12 },
    { wch: 20 },
    { wch: 22 },
    { wch: 22 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Issues');
  XLSX.writeFile(book, `${safeFilePart(filenameStem)}.xlsx`);
  toast.success(`Exported ${issues.length} issue${issues.length === 1 ? '' : 's'}`);
}
