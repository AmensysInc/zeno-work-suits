'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { useData } from '@/hooks/data';
import { label, testStatuses, testTypes, type Issue, type TestCase } from '@/types';
import { Badge, State, Tag } from '@/components/ui/display';
import { LinkButton } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IssueKey, ResultBadge, TypeIcon } from '@/components/ui/glyphs';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { FilterChip } from '@/components/issues/filters';
import { Button } from '@/components/ui/button';

const resultColor: Record<string, string> = { PASSED: '#16a34a', FAILED: '#e5484d', BLOCKED: '#e8a317', NOT_RUN: '#9ca0aa' };
const PAGE = 25;

/** Story test cases, or (with projectId) the filterable project repository. */
export default function TestCaseList({ issueId, projectId }: { issueId?: number; projectId?: number }) {
  const router = useRouter();
  const query = useData<TestCase[]>(issueId ? `/test-cases?issue_id=${issueId}` : `/test-cases?project_id=${projectId}`, !!(issueId || projectId));
  const issues = useData<Issue[]>(`/issues?project_id=${projectId}`, !!projectId);
  const [search, setSearch] = useState('');
  const [story, setStory] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(0);
  const stories = issues.data?.filter((i) => i.issue_type === 'STORY') ?? [];
  const all = query.data ?? [];
  const items = all.filter(
    (t) =>
      (!search || `${t.test_case_key} ${t.title}`.toLowerCase().includes(search.toLowerCase())) &&
      (!story || String(t.issue_id) === story) &&
      (!status || t.status === status) &&
      (!type || t.test_type === type),
  );
  const pages = Math.ceil(items.length / PAGE);
  const shown = items.slice(page * PAGE, page * PAGE + PAGE);
  const count = (s: string) => all.filter((t) => t.status === s).length;
  return (
    <div className={issueId ? 'overflow-hidden rounded-lg border border-line' : ''}>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 border-b border-line px-3 py-1.5 sm:px-[18px]">
        {projectId ? (
          <>
            <Input size="sm" icon={<Search />} className="w-full sm:w-[230px]" aria-label="Search test cases" placeholder="Search by key or title…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
            <FilterChip name="Story" value={story} onChange={(v) => { setStory(v); setPage(0); }} choices={stories.map((s) => ({ value: String(s.id), label: `${s.issue_key} — ${s.summary}`, icon: <TypeIcon type="STORY" size={14} /> }))} />
            <FilterChip name="Type" value={type} onChange={(v) => { setType(v); setPage(0); }} choices={testTypes.map((t) => ({ value: t, label: label(t) }))} />
            <FilterChip name="Result" value={status} onChange={(v) => { setStatus(v); setPage(0); }} choices={testStatuses.map((s) => ({ value: s, label: label(s) }))} />
          </>
        ) : (
          <span className="text-[13px] font-semibold">Test cases</span>
        )}
        <div className="flex-1" />
        <div className="hidden items-center gap-3 text-xs text-ink-2 md:flex">
          <span>
            Total <b className="tnum text-ink">{all.length}</b>
          </span>
          {['PASSED', 'FAILED', 'BLOCKED', 'NOT_RUN'].map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <i className="block size-[7px] rounded-full" style={{ background: resultColor[s] }} />
              {label(s)} <b className="tnum text-ink">{count(s)}</b>
            </span>
          ))}
        </div>
        {issueId && (
          <LinkButton size="sm" href={`/test-cases/new?story=${issueId}`} icon={<Plus className="size-3" />}>
            Add test case
          </LinkButton>
        )}
      </div>
      <State loading={query.isLoading} error={query.error} empty={!items.length && !query.isLoading} emptyText={all.length ? 'No test cases match these filters.' : 'Add a test case to start covering this work.'} />
      {!!items.length && (
        <Table>
          <thead>
            <tr>
              <Th className="w-24">Key</Th>
              <Th>Title</Th>
              {projectId && <Th className="w-28">Story</Th>}
              <Th className="w-28">Type</Th>
              <Th className="w-24">Covers</Th>
              <Th className="w-16">Steps</Th>
              <Th className="w-24">Last run</Th>
              <Th className="w-28">Result</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <Tr key={t.id} onClick={() => router.push(`/test-cases/${t.id}`)}>
                <Td>
                  <IssueKey>{t.test_case_key}</IssueKey>
                </Td>
                <Td className="font-medium">
                  <Link href={`/test-cases/${t.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-accent-ink">
                    {t.title}
                  </Link>
                </Td>
                {projectId && (
                  <Td>
                    <Link href={`/issues/${t.issue_id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5">
                      <TypeIcon type="STORY" size={14} />
                      <IssueKey>{stories.find((s) => s.id === t.issue_id)?.issue_key ?? '—'}</IssueKey>
                    </Link>
                  </Td>
                )}
                <Td>
                  <Tag>{label(t.test_type)}</Tag>
                </Td>
                <Td>{t.criterion_ids.length ? <span className="text-ink-2">{t.criterion_ids.length} criteria</span> : <Badge tone="amber">None</Badge>}</Td>
                <Td className="tnum text-ink-2">{t.steps.length}</Td>
                <Td className="text-xs text-ink-3">{t.last_executed_on ?? 'Never'}</Td>
                <Td>
                  <ResultBadge status={t.status} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between px-[18px] py-3 text-xs text-ink-3">
          <span>
            {page * PAGE + 1}–{Math.min(items.length, page * PAGE + PAGE)} of {items.length}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!page} onClick={() => setPage(page - 1)}>
              Prev
            </Button>
            <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
