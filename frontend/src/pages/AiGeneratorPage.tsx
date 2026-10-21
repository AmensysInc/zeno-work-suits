import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCurrentProject } from '../components/layout/AppShell';
import { Button } from '../components/ui/button';
import { Field, PageHeader, State } from '../components/ui/shared';
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
  type Project,
} from '../types';

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

function SourceNote({
  repository,
  modulePath,
  commit,
}: {
  repository: string;
  modulePath?: string;
  commit?: string;
}) {
  if (!repository && !commit) return null;
  return (
    <p className="muted">
      Source: {repository}
      {modulePath ? ` / ${modulePath}` : ''}
      {commit ? ` @ ${commit.slice(0, 7)}` : ''}
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
  const reviewRef = useRef<HTMLElement>(null);
  const status = useData<{
    github_configured: boolean;
    openai_configured: boolean;
  }>('/ai-generator/status');
  const modules = useData<GeneratorModule[]>(
    `/ai-generator/projects/${projectId}/modules`,
    !!project && !!repoName(project.github_repo),
  );
  const suggestions = useData<GeneratorSuggestions>(
    `/ai-generator/projects/${projectId}/change-suggestions`,
    !!project && !!repoName(project.github_repo),
  );
  const generate = useMutation({
    mutationFn: async () =>
      (
        await api.post<GeneratedDraft>('/ai-generator/generate', {
          project_id: projectId,
          module_path: modulePath,
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

  const toggleCoverage = (value: GeneratorCoverage) => {
    setCoverage((currentCoverage) =>
      currentCoverage.includes(value)
        ? currentCoverage.filter((item) => item !== value)
        : [...currentCoverage, value],
    );
  };

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
        <section className="card">
          <h2>Generate</h2>
          <Field label="GitHub repository">
            <select
              aria-label="GitHub repository"
              value={projectId ?? ''}
              onChange={(e) => nav(`/ai-generator?project=${e.target.value}`)}
            >
              {(projects.data ?? []).map((item: Project) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {repoName(item.github_repo)
                    ? ` · ${repoName(item.github_repo)}`
                    : ' · no repository'}
                </option>
              ))}
            </select>
          </Field>
          {project && !repoName(project.github_repo) && (
            <p className="muted">
              Link a repository on the <Link to="/github">GitHub</Link> page
              first.
            </p>
          )}
          <Field label="Application module">
            <select
              aria-label="Application module"
              value={modulePath}
              onChange={(e) => setModulePath(e.target.value)}
              disabled={!modules.data}
            >
              <option value="">Entire repository</option>
              {modules.data
                ?.filter((item) => item.path)
                .map((item) => (
                  <option key={item.path} value={item.path}>
                    {item.path} ({item.file_count} files)
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Generate">
            <select
              aria-label="Output type"
              value={outputType}
              onChange={(e) => setOutputType(e.target.value as GeneratorOutput)}
            >
              {generatorOutputs.map((value) => (
                <option key={value} value={value}>
                  {outputLabel[value]}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="field">
            <legend>Test coverage</legend>
            {generatorCoverage.map((value) => (
              <label key={value} className="check-row">
                <input
                  type="checkbox"
                  checked={coverage.includes(value)}
                  onChange={() => toggleCoverage(value)}
                />
                {coverageLabel[value]}
              </label>
            ))}
          </fieldset>
          <p className="muted">
            {status.data?.openai_configured
              ? 'OpenAI will draft from the selected source files.'
              : 'OpenAI is not configured, so drafts use code analysis until an API key is set.'}
          </p>
          <div className="actions">
            <Button
              disabled={!project || generate.isPending}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </section>
        <section className="card">
          <h2>GitHub changes</h2>
          {suggestions.data ? (
            <>
              <p>{suggestions.data.message}</p>
              <SourceNote
                repository={repoName(project?.github_repo ?? '') ?? ''}
                commit={suggestions.data.current_commit}
              />
              {suggestions.data.stale_story_ids.length > 0 && (
                <ul className="covered">
                  {suggestions.data.stale_story_ids.map((id) => (
                    <li key={id}>
                      <Link to={`/issues/${id}`}>Review story #{id}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="muted">
              After you save generated items, this panel flags them when the
              linked repository moves to a new commit.
            </p>
          )}
        </section>
      </div>
      {generate.isPending && <State loading />}
      {draft && (
        <section className="card generator-review" ref={reviewRef}>
          <div className="section-head">
            <div>
              <h2>Review before saving</h2>
              <SourceNote
                repository={draft.repository}
                modulePath={draft.module_path}
                commit={draft.source_commit}
              />
            </div>
            <Button
              disabled={!approvedCount || save.isPending}
              onClick={approve}
            >
              {save.isPending
                ? 'Saving…'
                : `Save ${approvedCount} approved item${approvedCount === 1 ? '' : 's'}`}
            </Button>
          </div>
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
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={selectedStories.has(index)}
                  onChange={() => {
                    const next = new Set(selectedStories);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    setSelectedStories(next);
                  }}
                />
                <strong>{story.title}</strong>
                <span className="muted">
                  {label(story.priority)} · {story.story_points} pts
                </span>
              </label>
              <p>{story.description}</p>
              <h3>Acceptance criteria</h3>
              <ul className="covered">
                {story.acceptance_criteria.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {story.test_cases.length > 0 && <h3>Manual test cases</h3>}
              {story.test_cases.map((test, testIndex) => (
                <div
                  className="generator-test"
                  key={`${test.title}-${testIndex}`}
                >
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedTests[index]?.has(testIndex) ?? false}
                      onChange={() => {
                        const currentTests = new Set(
                          selectedTests[index] ?? [],
                        );
                        if (currentTests.has(testIndex))
                          currentTests.delete(testIndex);
                        else currentTests.add(testIndex);
                        setSelectedTests({
                          ...selectedTests,
                          [index]: currentTests,
                        });
                      }}
                    />
                    <strong>{test.title}</strong>
                  </label>
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
        </section>
      )}
      {saved && (
        <section className="card">
          <h2>Saved to Zeno Work Suite</h2>
          <p>
            {saved.issue_ids.length} user{' '}
            {saved.issue_ids.length === 1 ? 'story' : 'stories'} and{' '}
            {saved.test_case_ids.length} test case
            {saved.test_case_ids.length === 1 ? '' : 's'} now live in the
            project.
          </p>
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
        </section>
      )}
    </>
  );
}
