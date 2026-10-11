import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../../hooks/data';
import type { Issue, TestCase } from '../../types';
import { label, testStatuses, testTypes } from '../../types';
import { Badge, State } from '../ui/shared';
import { Button } from '../ui/button';
/** Story test cases, or (with projectId) the filterable project repository. */
export default function TestCaseList({
  issueId,
  projectId,
}: {
  issueId?: number;
  projectId?: number;
}) {
  const query = useData<TestCase[]>(
    issueId
      ? `/test-cases?issue_id=${issueId}`
      : `/test-cases?project_id=${projectId}`,
    !!(issueId || projectId),
  );
  const issues = useData<Issue[]>(
    `/issues?project_id=${projectId}`,
    !!projectId,
  );
  const [search, setSearch] = useState('');
  const [story, setStory] = useState(0);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const stories = issues.data?.filter((i) => i.issue_type === 'STORY') ?? [];
  const all = query.data ?? [];
  const items = all.filter(
    (t) =>
      (!search ||
        `${t.test_case_key} ${t.title}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!story || t.issue_id === story) &&
      (!status || t.status === status) &&
      (!type || t.test_type === type),
  );
  return (
    <>
      <div className="test-stats">
        {[
          ['Total', all.length],
          ['Passed', all.filter((t) => t.status === 'PASSED').length],
          ['Failed', all.filter((t) => t.status === 'FAILED').length],
          ['Blocked', all.filter((t) => t.status === 'BLOCKED').length],
          ['Not run', all.filter((t) => t.status === 'NOT_RUN').length],
        ].map(([name, n]) => (
          <div key={name}>
            <strong>{n}</strong>
            <span>{name}</span>
          </div>
        ))}
      </div>
      <section className="card">
        <div className="section-head">
          <h2>Test cases</h2>
          <Button asChild>
            <Link to={`/test-cases/new${issueId ? `?story=${issueId}` : ''}`}>
              + Add test case
            </Link>
          </Button>
        </div>
        {projectId && (
          <div className="filters">
            <input
              type="search"
              aria-label="Search test cases"
              placeholder="Search by key or title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Filter by story"
              value={story}
              onChange={(e) => setStory(Number(e.target.value))}
            >
              <option value={0}>All stories</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.issue_key} — {s.summary}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by result"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All results</option>
              {testStatuses.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">All types</option>
              {testTypes.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </div>
        )}
        <State
          loading={query.isLoading}
          error={query.error}
          empty={items.length === 0 && !query.isLoading}
        />
        {!!items.length && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Title</th>
                  {projectId && <th>Story</th>}
                  <th>Type</th>
                  <th>Covers</th>
                  <th>Steps</th>
                  <th>Last run</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className="key">
                      <Link to={`/test-cases/${t.id}`}>{t.test_case_key}</Link>
                    </td>
                    <td>
                      <Link to={`/test-cases/${t.id}`}>{t.title}</Link>
                    </td>
                    {projectId && (
                      <td className="key">
                        <Link to={`/issues/${t.issue_id}`}>
                          {stories.find((s) => s.id === t.issue_id)?.issue_key}
                        </Link>
                      </td>
                    )}
                    <td>
                      <Badge value={t.test_type} />
                    </td>
                    <td className={t.criterion_ids.length ? 'muted' : 'warn'}>
                      {t.criterion_ids.length
                        ? `${t.criterion_ids.length} criteria`
                        : 'None'}
                    </td>
                    <td className="muted">{t.steps.length}</td>
                    <td className="muted">{t.last_executed_on ?? 'Never'}</td>
                    <td>
                      <Badge value={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
