'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Save, Sparkles, X } from 'lucide-react';
import { useCurrentProject } from '@/components/layout/context';
import { PageBar, PageBody } from '@/components/layout/page';
import RepoActivity from '@/components/github/repo-activity';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardHeader, Note, State } from '@/components/ui/display';
import { Field } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox, Segmented } from '@/components/ui/controls';
import { useData, useProjects } from '@/hooks/data';
import { api, errorMessage } from '@/lib/api';
import {
  generatorCoverage,
  generatorOutputs,
  label,
  repoName,
  type GeneratedDraft,
  type GeneratorCoverage,
  type GeneratorModule,
  type GeneratorOutput,
  type GeneratorSuggestions,
  type GitHubBranches,
  type GitHubCommit,
  type GitHubPull,
} from '@/types';
import { cn } from '@/lib/utils';

/** What to read instead of a default-branch module: only the code it changed. */
type Source = { kind: 'pull'; pull: GitHubPull } | { kind: 'branch'; name: string } | { kind: 'commit'; commit: GitHubCommit };

const coverageLabel: Record<GeneratorCoverage, string> = {
  POSITIVE: 'Positive',
  NEGATIVE: 'Negative',
  BOUNDARY: 'Boundary',
  VALIDATION: 'Validation',
};
const outputLabel: Record<GeneratorOutput, string> = {
  USER_STORIES: 'Stories & criteria',
  TEST_CASES: 'Test cases',
  BOTH: 'Both',
};

function sourceText(draft: GeneratedDraft) {
  const from = {
    DEFAULT: `${draft.source_ref || 'default branch'}${draft.module_path ? ` / ${draft.module_path}` : ''}`,
    BRANCH: `changes on ${draft.source_ref}`,
    PULL: `changes in PR #${draft.source_ref}`,
    COMMIT: 'changes in one commit',
  }[draft.source_kind ?? 'DEFAULT'];
  return `Source: ${draft.repository} · ${from}${draft.source_kind !== 'DEFAULT' && draft.module_path ? ` in ${draft.module_path}` : ''}${draft.source_commit ? ` @ ${draft.source_commit.slice(0, 7)}` : ''}`;
}

export default function AiGeneratorPage() {
  const projects = useProjects();
  const current = useCurrentProject();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const linked = (projects.data ?? []).filter((p) => repoName(p.github_repo));
  const projectId = Number(params.get('project')) || current || linked[0]?.id || projects.data?.[0]?.id;
  const project = projects.data?.find((p) => p.id === projectId);
  const [modulePath, setModulePath] = useState('');
  const [picked, setPicked] = useState<Source | null>(null);
  const pull = picked?.kind === 'pull' ? picked.pull : null;
  const branch = picked?.kind === 'branch' ? picked.name : '';
  const commit = picked?.kind === 'commit' ? picked.commit : null;
  const [outputType, setOutputType] = useState<GeneratorOutput>('BOTH');
  const [coverage, setCoverage] = useState<GeneratorCoverage[]>(['POSITIVE']);
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const [selectedStories, setSelectedStories] = useState<Set<number>>(new Set());
  const [selectedTests, setSelectedTests] = useState<Record<number, Set<number>>>({});
  const [saved, setSaved] = useState<{ issue_ids: number[]; test_case_ids: number[] } | null>(null);
  // Modules, pull requests, branches and drafts belong to one repository:
  // switching project starts over instead of showing the previous one's.
  const [shownProject, setShownProject] = useState(projectId);
  if (shownProject !== projectId) {
    setShownProject(projectId);
    setModulePath('');
    setPicked(null);
    setDraft(null);
    setSaved(null);
  }
  const reviewRef = useRef<HTMLDivElement>(null);
  const status = useData<{ github_configured: boolean; openai_configured: boolean }>('/ai-generator/status');
  const hasRepo = !!project && !!repoName(project.github_repo);
  const modules = useData<GeneratorModule[]>(`/ai-generator/projects/${projectId}/modules`, hasRepo);
  const pulls = useData<GitHubPull[]>(`/github/projects/${projectId}/pulls?state=all`, hasRepo && !!status.data?.github_configured);
  const branches = useData<GitHubBranches>(`/github/projects/${projectId}/branches`, hasRepo && !!status.data?.github_configured);
  const suggestions = useData<GeneratorSuggestions>(`/ai-generator/projects/${projectId}/change-suggestions`, hasRepo && !!status.data?.github_configured);
  // A pull request, branch or commit is read by what it changed, across the
  // whole repository; picking one again clears it.
  const pick = (next: Source | null) => {
    setModulePath('');
    setPicked(next);
  };
  const selectPull = (selected: GitHubPull) => pick(pull?.number === selected.number ? null : { kind: 'pull', pull: selected });
  const selectCommit = (selected: GitHubCommit) => pick(commit?.sha === selected.sha ? null : { kind: 'commit', commit: selected });
  // One dropdown carries modules, pull requests, branches and a picked commit; the prefix says which.
  const source = pull ? `pull:${pull.number}` : branch ? `branch:${branch}` : commit ? `commit:${commit.sha}` : `module:${modulePath}`;
  const selectSource = (value: string) => {
    const [kind, ...rest] = value.split(':');
    const target = rest.join(':');
    if (kind === 'pull') {
      const selected = pulls.data?.find((p) => String(p.number) === target) ?? (pull && String(pull.number) === target ? pull : undefined);
      if (selected) pick({ kind: 'pull', pull: selected });
    } else if (kind === 'branch') {
      pick({ kind: 'branch', name: target });
    } else if (kind === 'module') {
      setPicked(null);
      setModulePath(target);
    }
  };
  const staleStories = suggestions.data?.stale_story_ids.length ?? 0;
  const staleTests = suggestions.data?.stale_test_case_ids.length ?? 0;
  const pullOptions = [...(pull && !pulls.data?.some((p) => p.number === pull.number) ? [pull] : []), ...(pulls.data ?? [])].map((p) => ({
    value: `pull:${p.number}`,
    label: `#${p.number} ${p.title} (${p.state === 'open' ? p.head : p.state})`,
  }));
  const branchOptions = (branches.data?.branches ?? []).map((b) => ({ value: `branch:${b.name}`, label: b.name === branches.data?.default_branch ? `${b.name} (default)` : b.name }));
  const generate = useMutation({
    mutationFn: async () =>
      (
        await api.post<GeneratedDraft>('/ai-generator/generate', {
          project_id: projectId,
          module_path: modulePath,
          branch,
          pull_number: pull?.number ?? null,
          commit: commit?.sha ?? '',
          output_type: outputType,
          coverage: coverage.length ? coverage : ['POSITIVE'],
        })
      ).data,
    onSuccess: (next) => {
      setDraft(next);
      setSaved(null);
      setSelectedStories(new Set(next.user_stories.map((_, index) => index)));
      setSelectedTests(Object.fromEntries(next.user_stories.map((story, index) => [index, new Set(story.test_cases.map((_, t) => t))])));
      toast.success('Draft ready — review it below before saving');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: async (payload: GeneratedDraft) => (await api.post('/ai-generator/save', payload)).data as { issue_ids: number[]; test_case_ids: number[] },
    onSuccess: (result) => {
      setSaved(result);
      toast.success('Approved items saved to the project');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const approvedCount = useMemo(() => (draft ? [...selectedStories].reduce((count, index) => count + 1 + (selectedTests[index]?.size ?? 0), 0) : 0), [draft, selectedStories, selectedTests]);
  useEffect(() => {
    if (projectId && params.get('project') !== String(projectId)) {
      const next = new URLSearchParams(params);
      next.set('project', String(projectId));
      router.replace(`${pathname}?${next}`);
    }
  }, [params, projectId, router, pathname]);
  useEffect(() => {
    if (draft) reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [draft]);
  const approve = async () => {
    if (!draft) return;
    const user_stories = draft.user_stories
      .map((story, index) => ({ story, index }))
      .filter(({ index }) => selectedStories.has(index))
      .map(({ story, index }) => ({ ...story, test_cases: story.test_cases.filter((_, t) => selectedTests[index]?.has(t)) }));
    if (!user_stories.length) {
      toast.error('Select at least one user story to save');
      return;
    }
    try {
      await save.mutateAsync({ ...draft, user_stories });
    } catch {
      /* toast */
    }
  };
  if (!projects.data && (projects.isLoading || projects.error))
    return (
      <>
        <PageBar crumbs={['AI generator']} />
        <State loading={projects.isLoading} error={projects.error} />
      </>
    );
  return (
    <>
      <PageBar crumbs={['AI generator']} projectId={projectId} />
      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight">
              <Sparkles className="size-5 text-accent" /> Requirements & test generator
            </h1>
            <p className="text-[13px] text-ink-2">Read a linked GitHub module, pull request, branch or commit; draft user stories, acceptance criteria and manual tests; then approve what should be saved.</p>
          </div>
          {(staleStories > 0 || staleTests > 0) && (
            <Note tone="amber">
              <b>
                {staleStories} saved {staleStories === 1 ? 'story' : 'stories'} and {staleTests} test {staleTests === 1 ? 'case were' : 'cases were'} generated from code that has changed since.
              </b>{' '}
              Generate again from the same module, branch or pull request to draft updated versions.
            </Note>
          )}
          <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
            <Card className="flex flex-col gap-4 p-4">
              <Field label="GitHub repository">
                {(id) => (
                  <Select<number>
                    id={id}
                    value={projectId}
                    onChange={(v) => router.push(`/ai-generator?project=${v}`)}
                    options={(projects.data ?? []).map((p) => ({ value: p.id, label: `${p.name} · ${repoName(p.github_repo) ?? 'no repository'}` }))}
                  />
                )}
              </Field>
              {project && !hasRepo && (
                <Note tone="amber">
                  Link a repository on the{' '}
                  <Link href="/github" className="font-semibold underline">
                    GitHub
                  </Link>{' '}
                  page first.
                </Note>
              )}
              <Field label="Source" hint="A module reads its files on the default branch; a pull request, branch or commit reads only what it changed.">
                {(id) => (
                  <Select<string>
                    id={id}
                    value={source}
                    onChange={selectSource}
                    disabled={!modules.data}
                    groups={[
                      {
                        label: 'Modules',
                        options: [
                          { value: 'module:', label: 'Entire repository' },
                          // A pull request can point deeper than the listed folders.
                          ...(modulePath && !modules.data?.some((m) => m.path === modulePath) ? [{ value: `module:${modulePath}`, label: modulePath }] : []),
                          ...(modules.data ?? []).filter((m) => m.path).map((m) => ({ value: `module:${m.path}`, label: `${m.path} (${m.file_count} files)` })),
                        ],
                      },
                      ...(pullOptions.length ? [{ label: 'Pull requests', options: pullOptions }] : []),
                      ...(branchOptions.length ? [{ label: 'Branches', options: branchOptions }] : []),
                      ...(commit ? [{ label: 'Commit', options: [{ value: `commit:${commit.sha}`, label: `${commit.sha.slice(0, 7)} ${commit.message}` }] }] : []),
                    ]}
                  />
                )}
              </Field>
              {picked && (
                <Note tone="indigo">
                  <span className="flex items-start gap-2">
                    <span className="flex-1">
                      {pull
                        ? `From PR #${pull.number}: ${pull.title} — reads the files this pull request changes`
                        : commit
                          ? `From commit ${commit.sha.slice(0, 7)}: ${commit.message} — reads the files it changes`
                          : `From branch ${branch} — reads the files it changes compared with ${branches.data?.default_branch ?? 'the default branch'}`}
                    </span>
                    <button aria-label="Clear source" onClick={() => pick(null)} className="opacity-70 hover:opacity-100">
                      <X className="size-3.5" />
                    </button>
                  </span>
                </Note>
              )}
              <div className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium">Generate</span>
                <Segmented<GeneratorOutput> aria-label="Output type" className="w-full max-w-md" value={outputType} onChange={setOutputType} items={generatorOutputs.map((o) => ({ key: o, label: outputLabel[o] }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-medium">Test coverage</span>
                <div className="flex flex-wrap gap-2">
                  {generatorCoverage.map((c) => {
                    const on = coverage.includes(c);
                    return (
                      <button
                        key={c}
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => setCoverage(on ? coverage.filter((x) => x !== c) : [...coverage, c])}
                        className={cn('inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium', on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line-2 text-ink-2 hover:bg-hover')}
                      >
                        {on && <CheckCircle2 className="size-3.5" />}
                        {coverageLabel[c]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <span className="text-xs text-ink-3">{status.data?.openai_configured ? 'OpenAI will draft from the selected source files.' : 'OpenAI is not configured, so drafts use code analysis until an API key is set.'}</span>
                <Button variant="primary" size="lg" icon={<Sparkles />} disabled={!project} loading={generate.isPending} onClick={() => generate.mutate()}>
                  {generate.isPending ? 'Generating…' : 'Generate'}
                </Button>
              </div>
            </Card>
            <RepoActivity key={projectId} project={project} configured={status.data?.github_configured} selectedPull={pull?.number} onSelectPull={selectPull} selectedCommit={commit?.sha} onSelectCommit={selectCommit} />
          </div>

          {generate.isPending && <State loading />}
          {draft && (
            <div ref={reviewRef} className="scroll-mt-4">
              <Card className="overflow-hidden">
                <CardHeader
                  title="Review before saving"
                  subtitle={sourceText(draft)}
                  className="pb-3"
                  action={
                    <Button variant="primary" icon={<Save />} disabled={!approvedCount} loading={save.isPending} onClick={approve}>
                      Save {approvedCount} approved item{approvedCount === 1 ? '' : 's'}
                    </Button>
                  }
                />
                {draft.notes.length > 0 && (
                  <div className="flex flex-col gap-1 px-4 pb-3">
                    {draft.notes.map((note) => (
                      <p key={note} className="text-xs text-ink-3">
                        {note}
                      </p>
                    ))}
                  </div>
                )}
                {draft.user_stories.length === 0 && <p className="border-t border-line px-4 py-6 text-center text-[13px] text-ink-3">The draft came back empty. Try another module or coverage option, then generate again.</p>}
                {draft.user_stories.map((story, index) => {
                  const on = selectedStories.has(index);
                  return (
                    <article key={`${story.title}-${index}`} className={cn('flex flex-col gap-3 border-t border-line px-4 py-4', !on && 'opacity-60')}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5">
                          <Checkbox
                            aria-label={`Approve ${story.title}`}
                            checked={on}
                            onChange={() => {
                              const next = new Set(selectedStories);
                              if (next.has(index)) next.delete(index);
                              else next.add(index);
                              setSelectedStories(next);
                            }}
                          />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <b className="text-[14px] font-semibold">{story.title}</b>
                            <Badge value={story.priority} />
                            <span className="text-xs text-ink-3">{story.story_points} pts</span>
                          </span>
                          <p className="text-[13px] text-ink-2">{story.description}</p>
                        </div>
                      </div>
                      <div className="ml-7 flex flex-col gap-1">
                        <span className="caps">Acceptance criteria</span>
                        <ol className="flex flex-col gap-1">
                          {story.acceptance_criteria.map((item, i) => (
                            <li key={item} className="flex gap-2 text-[13px]">
                              <span className="tnum text-ink-3">{i + 1}.</span>
                              {item}
                            </li>
                          ))}
                        </ol>
                      </div>
                      {story.test_cases.length > 0 && (
                        <div className="ml-7 flex flex-col gap-2">
                          <span className="caps">Manual test cases</span>
                          {story.test_cases.map((test, t) => (
                            <div key={`${test.title}-${t}`} className="rounded-lg border border-line bg-subtle px-3 py-2.5">
                              <Checkbox
                                checked={selectedTests[index]?.has(t) ?? false}
                                onChange={() => {
                                  const tests = new Set(selectedTests[index] ?? []);
                                  if (tests.has(t)) tests.delete(t);
                                  else tests.add(t);
                                  setSelectedTests({ ...selectedTests, [index]: tests });
                                }}
                                label={<b className="font-semibold">{test.title}</b>}
                              />
                              <p className="ml-6 mt-0.5 text-xs text-ink-3">{test.criteria.length ? `Covers acceptance criteria ${test.criteria.map((i) => i + 1).join(', ')}` : 'Not linked to an acceptance criterion'}</p>
                              <ol className="ml-6 mt-2 flex list-decimal flex-col gap-1 pl-4 text-[12.5px]">
                                {test.steps.map((step, s) => (
                                  <li key={`${step.action}-${s}`}>
                                    {step.action} <span className="text-ink-3">— Expected: {step.expected_result}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </Card>
            </div>
          )}
          {saved && (
            <Card className="flex flex-col items-center gap-3 px-6 py-8 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#e8f7ee] text-green-600 dark:bg-[#1f3b2a]">
                <CheckCircle2 className="size-6" />
              </span>
              <span className="text-[16px] font-semibold">Saved to Zeno TeamSuite</span>
              <span className="text-[13px] text-ink-2">
                {saved.issue_ids.length} user {saved.issue_ids.length === 1 ? 'story' : 'stories'} and {saved.test_case_ids.length} test case{saved.test_case_ids.length === 1 ? '' : 's'} now live in the project.
              </span>
              <div className="flex flex-wrap justify-center gap-2">
                {saved.issue_ids.map((id, i) => (
                  <Link key={id} href={`/issues/${id}`} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-hover">
                    Story {i + 1} →
                  </Link>
                ))}
                {saved.test_case_ids.map((id, i) => (
                  <Link key={id} href={`/test-cases/${id}`} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-hover">
                    Test case {i + 1} →
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </PageBody>
    </>
  );
}
