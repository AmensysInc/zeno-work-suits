'use client';

import { useRef, useState } from 'react';
import { FileUp, Paperclip, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import FilePreview, { type PreviewTarget } from '@/components/issues/file-preview';

const ACCEPT =
  '.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.pdf,.txt,.csv,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.zip,.rar,.7z,.json,.xml,.yaml,.yml,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentField({
  id,
  files,
  onChange,
}: {
  id?: string;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.some((f) => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) continue;
      next.push(file);
    }
    onChange(next.slice(0, 20));
    if (input.current) input.current.value = '';
  };

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-line-2 bg-surface px-3 py-4 text-center transition-colors hover:border-accent hover:bg-hover',
        )}
      >
        <FileUp className="size-4 text-ink-3" />
        <span className="text-[12.5px] font-medium text-ink">Choose files to upload</span>
        <span className="text-[11.5px] text-ink-3">Images, PDF, Word, Excel, PowerPoint, ZIP — up to 25 MB each</span>
        <input
          ref={input}
          id={id}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => add(e.target.files)}
        />
      </label>
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex items-center gap-2 rounded-md border border-line bg-subtle px-2.5 py-1.5 text-[12.5px]"
            >
              <Paperclip className="size-3.5 shrink-0 text-ink-3" />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left font-medium text-accent-ink hover:underline"
                onClick={() => setPreview({ kind: 'local', file })}
              >
                {file.name}
              </button>
              <span className="shrink-0 text-ink-3">{formatSize(file.size)}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="shrink-0 px-1"
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <FilePreview target={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

export function formatAttachmentSize(bytes: number) {
  return formatSize(bytes);
}
