import { Link } from 'react-router-dom';
import { useData } from '../../hooks/data';
import type { TestCase } from '../../types';
import { Badge, State } from '../ui/shared';
import { Button } from '../ui/button';
export default function TestCaseList({ issueId }: { issueId?: number }) {
  const query = useData<TestCase[]>(
    `/test-cases${issueId ? `?issue_id=${issueId}` : ''}`,
  );
  const items = query.data ?? [];
  return (
    <>
      <div className="test-stats">
        {[
          ['Total', items.length],
          ['Passed', items.filter((t) => t.status === 'PASSED').length],
          ['Failed', items.filter((t) => t.status === 'FAILED').length],
          ['Not run', items.filter((t) => t.status === 'NOT_RUN').length],
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
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Status</th>
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
                    <td>
                      <Badge value={t.test_type} />
                    </td>
                    <td>
                      <Badge value={t.priority} />
                    </td>
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
