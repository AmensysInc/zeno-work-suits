import { Input } from 'antd';
import { Field } from '../ui/shared';
import { DateInput } from '../ui/form';
import { projectDates, type Project } from '../../types';

export const GITHUB_REPO = 'https://github\\.com/[\\w.\\-]+/[\\w.\\-]+/?';

/** Schedule and repository fields shared by the create and settings forms. */
export default function ProjectFields({ project }: { project?: Project }) {
  return (
    <>
      <div className="form-grid">
        {projectDates.map(([name, title]) => (
          <Field label={title} key={name}>
            <DateInput name={name} defaultValue={project?.[name]} />
          </Field>
        ))}
      </div>
      <Field label="GitHub repository">
        <Input
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
