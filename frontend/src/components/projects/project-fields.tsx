import { GithubIcon } from '@/components/ui/glyphs';
import { Field, Input } from '@/components/ui/input';
import { projectDates, type Project } from '@/types';

export const GITHUB_REPO = 'https://github\\.com/[\\w.\\-]+/[\\w.\\-]+/?';

/** Schedule and repository fields shared by the create and settings forms (uncontrolled, read via FormData). */
export default function ProjectFields({ project }: { project?: Project }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {projectDates.map(([name, title]) => (
          <Field key={name} label={title}>
            {(id) => <Input id={id} name={name} type="date" defaultValue={project?.[name] ?? ''} />}
          </Field>
        ))}
      </div>
      <Field label="GitHub repository" optional>
        {(id) => (
          <Input
            id={id}
            name="github_repo"
            type="url"
            inputMode="url"
            maxLength={500}
            pattern={GITHUB_REPO}
            title="A GitHub link such as https://github.com/acme/hr-portal"
            placeholder="https://github.com/acme/hr-portal"
            defaultValue={project?.github_repo ?? ''}
            icon={<GithubIcon />}
          />
        )}
      </Field>
    </>
  );
}
