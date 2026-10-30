import Link from 'next/link';
import { GithubIcon } from '@/components/ui/glyphs';
import { Field, Input } from '@/components/ui/input';
import { projectDates, type Project } from '@/types';

export const GITHUB_REPO = 'https://github\\.com/[\\w.\\-]+/[\\w.\\-]+/?';

/** Schedule and repository fields shared by the create and settings forms (uncontrolled, read via FormData). */
export default function ProjectFields({ project }: { project?: Project }) {
  const linked = project?.repositories ?? [];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {projectDates.map(([name, title]) => (
          <Field key={name} label={title}>
            {(id) => (
              <Input
                id={id}
                name={name}
                type="date"
                defaultValue={project?.[name] ?? ''}
              />
            )}
          </Field>
        ))}
      </div>
      {linked.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium">
            GitHub repositories{' '}
            <span className="font-normal text-ink-3">
              · {linked.length} linked
            </span>
          </span>
          <ul className="flex flex-col gap-1 rounded-lg border border-line px-3 py-2">
            {linked.map((r) => (
              <li
                key={r.full_name}
                className="flex items-center gap-2 text-[13px]"
              >
                <GithubIcon className="size-3.5 text-ink-3" />
                <a
                  href={r.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate hover:text-accent-ink hover:underline"
                >
                  {r.full_name}
                </a>
              </li>
            ))}
          </ul>
          <span className="text-xs text-ink-3">
            Unlink repositories on the{' '}
            <Link
              href={`/github?project=${project!.id}`}
              className="font-medium text-accent-ink hover:underline"
            >
              GitHub
            </Link>{' '}
            page.
          </span>
        </div>
      )}
      {/* The backend adds this to the linked repositories; it never replaces them. */}
      <Field
        label={
          linked.length ? 'Add another GitHub repository' : 'GitHub repository'
        }
        optional
      >
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
            defaultValue=""
            icon={<GithubIcon />}
          />
        )}
      </Field>
    </>
  );
}
