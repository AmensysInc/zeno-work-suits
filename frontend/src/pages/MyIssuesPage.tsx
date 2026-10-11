import { useSearchParams } from 'react-router-dom';
import { useData } from '../hooks/data';
import type { Issue } from '../types';
import { PageHeader, State } from '../components/ui/shared';
import IssueTable from '../components/issues/IssueTable';
export default function MyIssuesPage() {
  const [params] = useSearchParams();
  const q = params.get('q');
  const query = useData<Issue[]>(
    `/issues?${q !== null ? `q=${encodeURIComponent(q)}` : 'mine=true'}`,
  );
  return (
    <>
      <PageHeader
        title={q !== null ? 'Search results' : 'My Issues'}
        description={
          q !== null
            ? `Issues matching “${q}”`
            : 'Your work, across every project.'
        }
      />
      <section className="card">
        <State loading={query.isLoading} error={query.error} />
        {query.data && <IssueTable issues={query.data} />}
      </section>
    </>
  );
}
