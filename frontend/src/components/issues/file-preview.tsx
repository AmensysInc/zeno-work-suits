'use client';

import { useEffect, useState } from 'react';
import { Download, FileWarning } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';
import { downloadAttachment } from '@/lib/attachments';
import { toast } from 'sonner';

export type PreviewTarget =
  | { kind: 'local'; file: File }
  | { kind: 'remote'; id: number; filename: string; contentType: string };

function isImage(name: string, type: string) {
  return type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}

function isPdf(name: string, type: string) {
  return type === 'application/pdf' || /\.pdf$/i.test(name);
}

function isText(name: string, type: string) {
  return (
    type.startsWith('text/') ||
    type === 'application/json' ||
    type === 'application/xml' ||
    /\.(txt|csv|md|json|xml|ya?ml)$/i.test(name)
  );
}

export default function FilePreview({
  target,
  onClose,
}: {
  target: PreviewTarget | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const name = target?.kind === 'local' ? target.file.name : target?.filename ?? '';
  const type = target?.kind === 'local' ? target.file.type : target?.contentType ?? '';

  useEffect(() => {
    if (!target) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setUrl(null);
    setText(null);
    setError(null);
    setLoading(true);

    (async () => {
      try {
        let blob: Blob;
        let filename: string;
        let contentType: string;
        if (target.kind === 'local') {
          blob = target.file;
          filename = target.file.name;
          contentType = target.file.type || 'application/octet-stream';
        } else {
          const res = await api.get<Blob>(`/attachments/${target.id}/download`, { responseType: 'blob' });
          blob = res.data;
          filename = target.filename;
          contentType = target.contentType || blob.type || 'application/octet-stream';
        }
        if (cancelled) return;
        if (isText(filename, contentType) && !isImage(filename, contentType) && !isPdf(filename, contentType)) {
          setText(await blob.text());
        } else if (isImage(filename, contentType) || isPdf(filename, contentType)) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        } else {
          setError('Preview is not available for this file type. You can download it instead.');
        }
      } catch (e) {
        if (!cancelled) setError(errorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [target]);

  if (!target) return null;

  const canPreview = isImage(name, type) || isPdf(name, type) || isText(name, type);

  return (
    <Dialog
      onClose={onClose}
      title={name}
      description={canPreview ? 'File preview' : 'Preview unavailable'}
      width={960}
      tall
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button
            variant="primary"
            icon={<Download />}
            onClick={async () => {
              try {
                if (target.kind === 'local') {
                  const href = URL.createObjectURL(target.file);
                  const link = document.createElement('a');
                  link.href = href;
                  link.download = target.file.name;
                  link.click();
                  URL.revokeObjectURL(href);
                } else {
                  await downloadAttachment(target.id, target.filename);
                }
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          >
            Download
          </Button>
        </>
      }
    >
      <div className="flex min-h-[50vh] flex-col items-center justify-center">
        {loading && <p className="text-[13px] text-ink-3">Loading preview…</p>}
        {!loading && error && (
          <div className="flex max-w-md flex-col items-center gap-2 text-center">
            <FileWarning className="size-8 text-ink-3" />
            <p className="text-[13px] text-ink-2">{error}</p>
          </div>
        )}
        {!loading && !error && url && isImage(name, type) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="max-h-[68vh] max-w-full rounded-md object-contain" />
        )}
        {!loading && !error && url && isPdf(name, type) && (
          <iframe title={name} src={url} className="h-[68vh] w-full rounded-md border border-line bg-surface" />
        )}
        {!loading && !error && text != null && (
          <pre className="max-h-[68vh] w-full overflow-auto rounded-md border border-line bg-subtle p-3 text-[12.5px] leading-relaxed text-ink">
            {text}
          </pre>
        )}
      </div>
    </Dialog>
  );
}
