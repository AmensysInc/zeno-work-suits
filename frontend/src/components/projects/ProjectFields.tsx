import { Field } from '../ui/shared';
import { projectDates, type Project } from '../../types';

export const GITHUB_REPO = 'https://github\\.com/[\\w.\\-]+/[\\w.\\-]+/?';

/** Schedule and repository fields shared by the create and settings forms. */
export default function ProjectFields({ project }: { project?: Project }) {
  return (
    <>
      <div className="form-grid">
        {projectDates.map(([name, title]) => (
          <Field label={title} key={name}>
            <input
              name={name}
              type="date"
              defaultValue={project?.[name] ?? ''}
            />
          </Field>
        ))}
      </div>
      <Field label="GitHub repository">
        <input
          name="github_repo"
          type="url"
          inputMode="url"
          maxLength={500}
          pattern={GITHUB_REPO}
          title="A GitHub link such as https://github.com/acme/hr-portal"
          placeholder="https://github.com/acme/hr-portal"
          defaultValue={project?.github_repo ?? ''}
        />
      </Field>
    </>
  );
}
