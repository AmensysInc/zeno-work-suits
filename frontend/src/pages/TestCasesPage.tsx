import { PageHeader } from '../components/ui/shared';
import TestCaseList from '../components/testing/TestCaseList';
export default function TestCasesPage() {
  return (
    <>
      <PageHeader
        title="Test Cases"
        description="Make quality part of every story."
      />
      <TestCaseList />
    </>
  );
}
