'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useData } from '@/hooks/data';
import { statuses, type Issue } from '@/types';
import { PageBar, PageBody, Toolbar } from '@/components/layout/page';
import { Empty, State } from '@/components/ui/display';
import { Input } from '@/components/ui/input';
import { StatusIcon, statusMeta } from '@/components/ui/glyphs';
import IssueList from '@/components/issues/issue-list';

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="rounded-[3px] bg-amber-100 font-semibold text-inherit dark:bg-amber-500/25">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}

/** Your assigned work, grouped by status; with ?q= it is the issue search. */
export default function MyIssuesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get('q');
  const searching = q !== null;
  const [text, setText] = useState(q ?? '');
  useEffect(() => setText(q ?? ''), [q]);
  const query = useData<Issue[]>(`/issues?${searching ? `q=${encodeURIComponent(q)}` : 'mine=true'}`, !searching || !!q);
  const issues = query.data ?? [];
  const search = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/my-issues?q=${encodeURIComponent(text.trim())}`);
      }}
      className="w-full sm:w-[320px]"
    >
      <Input
        size="sm"
        icon={<Search />}
        autoFocus={searching}
        aria-label="Search issues"
        placeholder="Search all issues…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        suffix={
          searching ? (
            <button type="button" aria-label="Clear search" onClick={() => router.push('/my-issues')}>
              <X />
            </button>
          ) : undefined
        }
      />
    </form>
  );
  return (
    <>
      <PageBar crumbs={[searching ? 'Search' : 'My issues']} actions={<div className="hidden sm:block">{search}</div>} />
      <Toolbar>
        <div className="w-full sm:hidden">{search}</div>
        {searching ? (
          q ? (
            <span className="text-[12.5px]">
              <b className="font-semibold">{issues.length} issues</b> <span className="text-ink-2">match “{q}”</span>
              <span className="text-xs text-ink-3"> · summary or key</span>
            </span>
          ) : (
            <span className="text-[12.5px] text-ink-2">Search summaries and keys across every project you can see.</span>
          )
        ) : (
          <span className="text-[12.5px] text-ink-2">
            Assigned to you across every project <span className="text-xs text-ink-3">· {issues.filter((i) => i.status !== 'DONE').length} open</span>
          </span>
        )}
      </Toolbar>
      <PageBody padded={false}>
        <State loading={query.isLoading && query.fetchStatus !== 'idle'} error={query.error} />
        {searching ? (
          q ? (
            <IssueList showProject issues={issues} highlight={(t) => <Highlight text={t} term={q} />} empty={<Empty icon={<Search />} title="No matching issues">Try a different word or an issue key.</Empty>} />
          ) : null
        ) : query.data && !issues.length ? (
          <Empty title="Nothing assigned to you">Issues assigned to you in any project show up here.</Empty>
        ) : (
          statuses
            .map((s) => [s, issues.filter((i) => i.status === s)] as const)
            .filter(([, rows]) => rows.length)
            .map(([s, rows]) => (
              <section key={s}>
                <div className="flex h-9 items-center gap-2 border-b border-line bg-subtle px-3 text-[13px] font-semibold sm:px-[18px]">
                  <StatusIcon status={s} />
                  {statusMeta[s].label}
                  <span className="font-medium text-ink-3">{rows.length}</span>
                </div>
                <IssueList showProject issues={rows} />
              </section>
            ))
        )}
      </PageBody>
    </>
  );
}
