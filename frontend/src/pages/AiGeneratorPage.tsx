import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Alert, Card, Checkbox, Result, Typography } from 'antd';
import { RobotOutlined, SaveOutlined } from '@ant-design/icons';
import { useCurrentProject } from '../components/layout/AppShell';
import RepoActivity from '../components/github/RepoActivity';
import { Button } from '../components/ui/button';
import { Field, PageHeader, State } from '../components/ui/shared';
import { Select } from '../components/ui/form';
import { useData, useProjects } from '../hooks/data';
import { api, errorMessage } from '../services/api';
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
  type Project,
} from '../types';

/** What to read instead of a default-branch module: only the code it changed. */
type Source =
  | { kind: 'pull'; pull: GitHubPull }
  | { kind: 'branch'; name: string }
  | { kind: 'commit'; commit: GitHubCommit };

const coverageLabel: Record<GeneratorCoverage, string> = {
  POSITIVE: 'Positive scenarios',
  NEGATIVE: 'Negative scenarios',
  BOUNDARY: 'Boundary scenarios',
  VALIDATION: 'Validation scenarios',
};

const outputLabel: Record<GeneratorOutput, string> = {
  USER_STORIES: 'User Stories & Acceptance Criteria',
  TEST_CASES: 'Manual Functional Test Cases',
  BOTH: 'Both',
};

function SourceNote({ draft }: { draft: GeneratedDraft }) {
  const from = {
    DEFAULT: `${draft.source_ref || 'default branch'}${draft.module_path ? ` / ${draft.module_path}` : ''}`,
    BRANCH: `changes on ${draft.source_ref}`,
    PULL: `changes in PR #${draft.source_ref}`,
    COMMIT: 'changes in one commit',
  }[draft.source_kind ?? 'DEFAULT'];
  return (
    <p className="muted">
      Source: {draft.repository} · {from}
      {draft.source_kind !== 'DEFAULT' && draft.module_path
        ? ` in ${draft.module_path}`
        : ''}
      {draft.source_commit ? ` @ ${draft.source_commit.slice(0, 7)}` : ''}
    </p>
  );
}

export default function AiGeneratorPage() {
  const projects = useProjects();
  const current = useCurrentProject();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const linked = (projects.data ?? []).filter((p) => repoName(p.github_repo));
  const projectId =
    Number(params.get('project')) ||
    current ||
    linked[0]?.id ||
    projects.data?.[0]?.id;
  const project = projects.data?.find((p) => p.id === projectId);
  const [modulePath, setModulePath] = useState('');
  const [picked, setPicked] = useState<Source | null>(null);
  const pull = picked?.kind === 'pull' ? picked.pull : null;
  const branch = picked?.kind === 'branch' ? picked.name : '';
  const commit = picked?.kind === 'commit' ? picked.commit : null;
  const [outputType, setOutputType] = useState<GeneratorOutput>('BOTH');
  const [coverage, setCoverage] = useState<GeneratorCoverage[]>(['POSITIVE']);
  const [draft, setDraft] = useState<GeneratedDraft | null>(null);
  const [selectedStories, setSelectedStories] = useState<Set<number>>(
    new Set(),
  );
  const [selectedTests, setSelectedTests] = useState<
    Record<number, Set<number>>
  >({});
  const [saved, setSaved] = useState<{
    issue_ids: number[];
    test_case_ids: number[];
  } | null>(null);
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
  const status = useData<{
    github_configured: boolean;
    openai_configured: boolean;
  }>('/ai-generator/status');
  const modules = useData<GeneratorModule[]>(
    `/ai-generator/projects/${projectId}/modules`,
    !!project && !!repoName(project.github_repo),
  );
  const hasRepo = !!project && !!repoName(project.github_repo);
  const pulls = useData<GitHubPull[]>(
    `/github/projects/${projectId}/pulls?state=all`,
    hasRepo && !!status.data?.github_configured,
  );
  const branches = useData<GitHubBranches>(
    `/github/projects/${projectId}/branches`,
    hasRepo && !!status.data?.github_configured,
  );
  const suggestions = useData<GeneratorSuggestions>(
    `/ai-generator/projects/${projectId}/change-suggestions`,
    hasRepo && !!status.data?.github_configured,
  );
  // A pull request, branch or commit is read by what it changed, across the
  // whole repository; picking one again clears it.
  const pick = (next: Source | null) => {
    setModulePath('');
    setPicked(next);
  };
  const selectPull = (selected: GitHubPull) =>
    pick(pull?.number === selected.number ? null : { kind: 'pull', pull: selected });
  const selectCommit = (selected: GitHubCommit) =>
    pick(
      commit?.sha === selected.sha ? null : { kind: 'commit', commit: selected },
    );
  // One dropdown carries modules, pull requests, branches and a picked
  // commit; the prefix says which.
  const source = pull
    ? `pull:${pull.number}`
    : branch
      ? `branch:${branch}`
      : commit
        ? `commit:${commit.sha}`
        : `module:${modulePath}`;
  const selectSource = (value: string) => {
    const [kind, ...rest] = value.split(':');
    const target = rest.join(':');
    if (kind === 'pull') {
      const selected =
        pulls.data?.find((p) => String(p.number) === target) ??
        (pull && String(pull.number) === target ? pull : undefined);
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
  const pullOptions = [
    ...(pull && !pulls.data?.some((p) => p.number === pull.number)
      ? [pull]
      : []),
    ...(pulls.data ?? []),
  ].map((p) => ({
    value: `pull:${p.number}`,
    label: `#${p.number} ${p.title} (${p.state === 'open' ? p.head : p.state})`,
  }));
  const branchOptions = (branches.data?.branches ?? []).map((b) => ({
    value: `branch:${b.name}`,
    label:
      b.name === branches.data?.default_branch ? `${b.name} (default)` : b.name,
  }));
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
      setSelectedTests(
        Object.fromEntries(
          next.user_stories.map((story, index) => [
            index,
            new Set(story.test_cases.map((_, testIndex) => testIndex)),
          ]),
        ),
      );
      toast.success('Draft ready — scroll down to Review before saving');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: async (payload: GeneratedDraft) =>
      (await api.post('/ai-generator/save', payload)).data as {
        issue_ids: number[];
        test_case_ids: number[];
      },
    onSuccess: (result) => {
      setSaved(result);
      toast.success('Approved items saved to the project');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const approvedCount = useMemo(() => {
    if (!draft) return 0;
    return [...selectedStories].reduce((count, index) => {
      const tests = selectedTests[index]?.size ?? 0;
      return count + 1 + tests;
    }, 0);
  }, [draft, selectedStories, selectedTests]);

  useEffect(() => {
    if (projectId && params.get('project') !== String(projectId)) {
      const next = new URLSearchParams(params);
      next.set('project', String(projectId));
      setParams(next, { replace: true });
    }
  }, [params, projectId, setParams]);

  useEffect(() => {
    if (draft) {
      reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [draft]);

  const approve = async () => {
    if (!draft) return;
    const user_stories = draft.user_stories
      .map((story, index) => ({ story, index }))
      .filter(({ index }) => selectedStories.has(index))
      .map(({ story, index }) => ({
        ...story,
        test_cases: story.test_cases.filter((_, testIndex) =>
          selectedTests[index]?.has(testIndex),
        ),
      }));
    if (!user_stories.length) {
      toast.error('Select at least one user story to save');
      return;
    }
    await save.mutateAsync({ ...draft, user_stories });
  };

  if (!projects.data && (projects.isLoading || projects.error)) {
    return <State loading={projects.isLoading} error={projects.error} />;
  }

  return (
    <>
      <PageHeader
        title="AI Requirements & Test Generator"
        description="Read a linked GitHub module, draft user stories, acceptance criteria and manual tests, then approve what should be saved."
      />
      <div className="generator-grid">
        <Card className="card" title="Generate">
          <Field label="GitHub repository">
            <Select
              aria-label="GitHub repository"
              value={projectId}
              onChange={(v) => nav(`/ai-generator?project=${v}`)}
              options={(projects.data ?? []).map((item: Project) => ({
                value: item.id,
                label: `${item.name}${
                  repoName(item.github_repo)
                    ? ` · ${repoName(item.github_repo)}`
                    : ' · no repository'
                }`,
              }))}
            />
          </Field>
          {project && !repoName(project.github_repo) && (
            <Alert
              className="linked-context"
              type="warning"
              showIcon
              title={
                <>
                  Link a repository on the <Link to="/github">GitHub</Link> page
                  first.
                </>
              }
            />
          )}
          <Field label="Application module">
            <Select
              aria-label="Application module"
              value={source}
              onChange={selectSource}
              disabled={!modules.data}
              options={[
                {
                  label: 'Modules',
                  options: [
                    { value: 'module:', label: 'Entire repository' },
                    // A pull request can point deeper than the listed folders.
                    ...(modulePath &&
                    !modules.data?.some((item) => item.path === modulePath)
                      ? [{ value: `module:${modulePath}`, label: modulePath }]
                      : []),
                    ...(modules.data ?? [])
                      .filter((item) => item.path)
                      .map((item) => ({
                        value: `module:${item.path}`,
                        label: `${item.path} (${item.file_count} files)`,
                      })),
                  ],
                },
                ...(pullOptions.length
                  ? [{ label: 'Pull requests', options: pullOptions }]
                  : []),
                ...(branchOptions.length
                  ? [{ label: 'Branches', options: branchOptions }]
                  : []),
                ...(commit
                  ? [
                      {
                        label: 'Commit',
                        options: [
                          {
                            value: `commit:${commit.sha}`,
                            label: `${commit.sha.slice(0, 7)} ${commit.message}`,
                          },
                        ],
                      },
                    ]
                  : []),
              ]}
            />
          </Field>
          {picked && (
            <Alert
              className="linked-context"
              type="info"
              showIcon
              closable={{ onClose: () => pick(null) }}
              title={
                pull
                  ? `From PR #${pull.number}: ${pull.title} — reads the files this pull request changes`
                  : commit
                    ? `From commit ${commit.sha.slice(0, 7)}: ${commit.message} — reads the files it changes`
                    : `From branch ${branch} — reads the files it changes compared with ${branches.data?.default_branch ?? 'the default branch'}`
              }
            />
          )}
          <Field label="Generate">
            <Select
              aria-label="Output type"
              value={outputType}
              onChange={(v) => setOutputType(v as GeneratorOutput)}
              options={generatorOutputs.map((value) => ({
                value,
                label: outputLabel[value],
              }))}
            />
          </Field>
          <div className="field">
            <span>Test coverage</span>
            <Checkbox.Group
              className="coverage-group"
              value={coverage}
              onChange={(v) => setCoverage(v as GeneratorCoverage[])}
              options={generatorCoverage.map((value) => ({
                value,
                label: coverageLabel[value],
              }))}
            />
          </div>
          <p className="muted">
            {status.data?.openai_configured
              ? 'OpenAI will draft from the selected source files.'
              : 'OpenAI is not configured, so drafts use code analysis until an API key is set.'}
          </p>
          <div className="actions">
            <Button
              icon={<RobotOutlined />}
              disabled={!project}
              loading={generate.isPending}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </Card>
        <RepoActivity
          key={projectId}
          project={project}
          configured={status.data?.github_configured}
          selectedPull={pull?.number}
          onSelectPull={selectPull}
          selectedCommit={commit?.sha}
          onSelectCommit={selectCommit}
        />
      </div>
      {(staleStories > 0 || staleTests > 0) && (
        <Alert
          className="spaced"
          type="warning"
          showIcon
          title={`${staleStories} saved ${staleStories === 1 ? 'story' : 'stories'} and ${staleTests} test ${staleTests === 1 ? 'case were' : 'cases were'} generated from code that has changed since.`}
          description="Generate again from the same module, branch or pull request to draft updated versions."
        />
      )}
      {generate.isPending && <State loading />}
      {draft && (
        <Card
          className="card generator-review"
          ref={reviewRef}
          title="Review before saving"
          extra={
            <Button
              icon={<SaveOutlined />}
              disabled={!approvedCount}
              loading={save.isPending}
              onClick={approve}
            >
              {`Save ${approvedCount} approved item${approvedCount === 1 ? '' : 's'}`}
            </Button>
          }
        >
          <SourceNote draft={draft} />
          {draft.notes.map((note) => (
            <p className="muted" key={note}>
              {note}
            </p>
          ))}
          {draft.user_stories.length === 0 && (
            <p className="muted">
              The draft came back empty. Try another module or coverage option,
              then generate again.
            </p>
          )}
          {draft.user_stories.map((story, index) => (
            <article
              className="generator-story"
              key={`${story.title}-${index}`}
            >
              <Checkbox
                className="check-row"
                checked={selectedStories.has(index)}
                onChange={() => {
                  const next = new Set(selectedStories);
                  if (next.has(index)) next.delete(index);
                  else next.add(index);
                  setSelectedStories(next);
                }}
              >
                <strong>{story.title}</strong>{' '}
                <Typography.Text type="secondary">
                  {label(story.priority)} · {story.story_points} pts
                </Typography.Text>
              </Checkbox>
              <p>{story.description}</p>
              <Typography.Title level={5}>Acceptance criteria</Typography.Title>
              <ul className="covered">
                {story.acceptance_criteria.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {story.test_cases.length > 0 && (
                <Typography.Title level={5}>Manual test cases</Typography.Title>
              )}
              {story.test_cases.map((test, testIndex) => (
                <div
                  className="generator-test"
                  key={`${test.title}-${testIndex}`}
                >
                  <Checkbox
                    className="check-row"
                    checked={selectedTests[index]?.has(testIndex) ?? false}
                    onChange={() => {
                      const currentTests = new Set(selectedTests[index] ?? []);
                      if (currentTests.has(testIndex))
                        currentTests.delete(testIndex);
                      else currentTests.add(testIndex);
                      setSelectedTests({
                        ...selectedTests,
                        [index]: currentTests,
                      });
                    }}
                  >
                    <strong>{test.title}</strong>
                  </Checkbox>
                  <p className="muted">
                    {test.criteria.length
                      ? `Covers acceptance criteria ${test.criteria.map((i) => i + 1).join(', ')}`
                      : 'Not linked to an acceptance criterion'}
                  </p>
                  <ol>
                    {test.steps.map((step, stepIndex) => (
                      <li key={`${step.action}-${stepIndex}`}>
                        {step.action}{' '}
                        <span className="muted">
                          Expected: {step.expected_result}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </article>
          ))}
        </Card>
      )}
      {saved && (
        <Card className="card">
          <Result
            status="success"
            title="Saved to Zeno TeamSuite"
            subTitle={`${saved.issue_ids.length} user ${
              saved.issue_ids.length === 1 ? 'story' : 'stories'
            } and ${saved.test_case_ids.length} test case${
              saved.test_case_ids.length === 1 ? '' : 's'
            } now live in the project.`}
          />
          <ul className="covered">
            {saved.issue_ids.map((id) => (
              <li key={id}>
                <Link to={`/issues/${id}`}>Open saved story</Link>
              </li>
            ))}
            {saved.test_case_ids.map((id) => (
              <li key={id}>
                <Link to={`/test-cases/${id}`}>Open saved test case</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
