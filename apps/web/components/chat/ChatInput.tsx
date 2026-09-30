'use client';

import { useRef, useState } from 'react';
import { Loader2, Paperclip, SendHorizonal, X } from 'lucide-react';

/**
 * ChatInput (10.5.2) — text composer + image/file attach.
 * Calls onTyping while the user types (throttled in useChat) for the
 * presence typing indicator (10.5.5).
 */

const MAX_FILE_MB = 10;

export function ChatInput({
  onSendText,
  onSendFile,
  onTyping,
  disabled,
}: {
  onSendText: (body: string) => Promise<unknown>;
  onSendFile: (file: File) => Promise<unknown>;
  onTyping: () => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    const text = value.trim();
    if (!text && !pendingFile) return;
    setError(null);
    setBusy(true);
    try {
      if (pendingFile) {
        await onSendFile(pendingFile);
        setPendingFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        await onSendText(text);
      }
      setValue('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch {
      setError('ارسال پیام ناموفق بود — دوباره تلاش کنید');
    } finally {
      setBusy(false);
    }
  };

  const pickFile = (file: File | undefined | null) => {
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`حجم فایل حداکثر ${MAX_FILE_MB} مگابایت است`);
      return;
    }
    setError(null);
    setPendingFile(file);
  };

  return (
    <div className="border-t border-gray-100 bg-white/95 p-3 backdrop-blur">
      {pendingFile && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-45 truncate font-bold">{pendingFile.name}</span>
          <button
            type="button"
            onClick={() => {
              setPendingFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="mr-auto rounded-full p-1 text-gray-400 hover:text-red-500"
            aria-label="حذف فایل"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || busy}
          className="hover:border-brand-300 hover:text-brand-600 shrink-0 rounded-xl border border-gray-200 p-2.5 text-gray-500 transition-colors disabled:opacity-40"
          aria-label="پیوست تصویر یا فایل"
        >
          <Paperclip className="h-4.5 w-4.5" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled || busy}
          placeholder="پیام خود را بنویسید…"
          onChange={(e) => {
            setValue(e.target.value);
            onTyping();
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          className="max-h-30 focus:border-brand-400 min-h-11 flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition-colors focus:bg-white"
        />

        <button
          type="button"
          onClick={() => void submit()}
          disabled={disabled || busy || (!value.trim() && !pendingFile)}
          className="bg-brand-600 hover:bg-brand-700 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-opacity disabled:opacity-40"
          aria-label="ارسال"
        >
          {busy ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <SendHorizonal className="h-4.5 w-4.5" />
          )}
        </button>
      </div>
    </div>
  );
}
