import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/shared';
import TestCaseForm from '../components/testing/TestCaseForm';
export default function AddTestCasePage() {
  const [params] = useSearchParams();
  return (
    <>
      <PageHeader
        title="Add Test Case"
        description="Create a QA test directly against a user story."
      />
      <TestCaseForm storyId={Number(params.get('story')) || undefined} />
    </>
  );
}
