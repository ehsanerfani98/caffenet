'use client';

import { useRef, useState } from 'react';
import { Camera, FileUp, Image as ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { uploadFile } from '@/lib/api/requests';
import { formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * FileUploader (7.6.8) — drag-drop + camera capture, uploads immediately
 * to POST /files/upload and reports file IDs back to the wizard.
 */

export interface UploadedFileChip {
  fileId: string;
  name: string;
  size?: number;
  mimeType?: string;
}

interface FileUploaderProps {
  fileIds: string[];
  onChange: (fileIds: string[]) => void;
  /** Only images (camera) — service field type = image */
  imagesOnly?: boolean;
  maxFiles?: number;
  className?: string;
}

export function FileUploader({
  fileIds,
  onChange,
  imagesOnly = false,
  maxFiles = 10,
  className,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, UploadedFileChip>>({});
  const [dragOver, setDragOver] = useState(false);

  const full = fileIds.length >= maxFiles;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || full) return;
    setError(null);
    const room = maxFiles - fileIds.length;
    const selected = Array.from(files).slice(0, room);

    const invalid = selected.find((f) =>
      imagesOnly ? !f.type.startsWith('image/') : f.size > 15 * 1024 * 1024,
    );
    if (invalid && imagesOnly) {
      setError('فقط تصاویر مجاز هستند');
      return;
    }
    if (invalid) {
      setError('حجم فایل نباید بیشتر از ۱۵ مگابایت باشد');
      return;
    }

    setUploading((n) => n + selected.length);
    const uploadedIds: string[] = [];
    const uploadedMeta: Record<string, UploadedFileChip> = {};

    for (const f of selected) {
      try {
        const res = await uploadFile(f, 'private');
        uploadedIds.push(res.id);
        uploadedMeta[res.id] = {
          fileId: res.id,
          name: res.originalName ?? f.name,
          size: f.size,
          mimeType: f.type,
        };
      } catch {
        setError(`آپلود «${f.name}» ناموفق بود`);
      } finally {
        setUploading((n) => n - 1);
      }
    }

    if (uploadedIds.length) {
      setMeta((m) => ({ ...m, ...uploadedMeta }));
      onChange([...fileIds, ...uploadedIds]);
    }
  };

  const remove = (id: string) => {
    onChange(fileIds.filter((f) => f !== id));
  };

  return (
    <div className={className}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
          dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-gray-50',
          full && 'opacity-50',
        )}
      >
        <FileUp className="h-7 w-7 text-gray-400" />
        <p className="text-sm text-gray-600">فایل‌ها را بکشید و رها کنید</p>
        <p className="text-xs text-gray-400">حداکثر {maxFiles} فایل — تا ۱۵ مگابایت</p>

        <div className="mt-2 flex gap-2">
          {imagesOnly ? (
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={full || uploading > 0}
              className="bg-brand-600 active:bg-brand-700 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              گرفتن عکس
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={full || uploading > 0}
              className="bg-brand-600 active:bg-brand-700 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              <FileUp className="h-4 w-4" />
              انتخاب فایل
            </button>
          )}
        </div>

        {uploading > 0 && (
          <p className="text-brand-700 mt-1 flex items-center gap-1.5 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            در حال آپلود…
          </p>
        )}
        {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {/* Uploaded chips */}
      {fileIds.length > 0 && (
        <ul className="mt-3 space-y-2">
          {fileIds.map((id) => {
            const m = meta[id];
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-2.5"
              >
                {m?.mimeType?.startsWith('image/') ? (
                  <ImageIcon className="text-brand-600 h-4 w-4 shrink-0" />
                ) : (
                  <FileUp className="h-4 w-4 shrink-0 text-gray-400" />
                )}
                <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                  {m?.name ?? `فایل ${id}`}
                </span>
                {m?.size ? (
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {formatFileSize(m.size)}
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label="حذف فایل"
                  onClick={() => remove(id)}
                  className="shrink-0 rounded-full p-1 text-gray-400 active:bg-gray-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
