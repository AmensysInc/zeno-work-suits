'use client';

import { useSearchParams } from 'next/navigation';
import { PageBar, PageBody } from '@/components/layout/page';
import TestCaseForm from '@/components/testing/test-case-form';

export default function AddTestCasePage() {
  const params = useSearchParams();
  return (
    <>
      <PageBar crumbs={[{ label: 'Test repository', href: '/test-cases' }, 'New test case']} />
      <PageBody>
        <div className="mx-auto max-w-[960px]">
          <p className="mb-4 text-[13px] text-ink-2">Create a QA test directly against a user story.</p>
          <TestCaseForm storyId={Number(params.get('story')) || undefined} />
        </div>
      </PageBody>
    </>
  );
}
