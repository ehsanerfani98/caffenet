'use client';

import { memo } from 'react';
import { Check, CheckCheck, Clock, FileText, ImageOff, Loader2 } from 'lucide-react';
import type { ChatMessageDto } from '@/lib/api/chat';
import { formatFileSize, formatRelative, toPersianDigits } from '@/lib/format';

/**
 * ChatMessage component (10.5.1) — text / image / file / system bubbles.
 * Own messages: brand bubble on the left side (RTL), receipts (10.5.6):
 *   ⏳ sending · ✓ sent · ✓✓ read. Deleted → tombstone. System → centered.
 */

function Receipt({ message }: { message: ChatMessageDto }) {
  if (!message.isMine) return null;
  if (message.id.startsWith('tmp-')) {
    return <Loader2 className="h-3 w-3 animate-spin text-white/60" aria-label="در حال ارسال" />;
  }
  if (message.readAt) {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="خوانده شد" />;
  }
  return <Check className="h-3.5 w-3.5 text-white/60" aria-label="ارسال شد" />;
}

function Attachment({ message }: { message: ChatMessageDto }) {
  const att = message.attachments[0];
  if (!att) return null;

  if (message.type === 'image' && att.url) {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={att.url}
          alt={att.fileName}
          className="max-h-56 w-auto max-w-full rounded-xl object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  if (message.type === 'image') {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-xs">
        <ImageOff className="h-4 w-4" />
        پیش‌نمایش تصویر در دسترس نیست
      </div>
    );
  }

  return (
    <a
      href={att.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-xs font-bold transition-colors hover:bg-black/20"
    >
      <FileText className="h-4 w-4 shrink-0" />
      <span className="max-w-45 truncate">{att.fileName}</span>
      <span className="shrink-0 opacity-70">({formatFileSize(att.fileSize)})</span>
    </a>
  );
}

function ChatMessageItemBase({ message }: { message: ChatMessageDto }) {
  if (message.type === 'system') {
    return (
      <div className="my-2 text-center">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-500">
          {message.body}
        </span>
      </div>
    );
  }

  if (message.deletedAt) {
    return (
      <div className={`flex ${message.isMine ? 'justify-start' : 'justify-end'}`}>
        <div className="rounded-2xl bg-gray-100 px-3 py-1.5 text-[11px] italic text-gray-400">
          این پیام حذف شده است
        </div>
      </div>
    );
  }

  const isMine = message.isMine;
  const time = formatRelative(message.createdAt);

  return (
    <div className={`flex items-end gap-1.5 ${isMine ? 'justify-start' : 'justify-end'}`}>
      {isMine && (
        <span
          className="mb-1 flex items-center gap-0.5"
          title={message.readAt ? 'خوانده شد' : 'ارسال شد'}
        >
          <Receipt message={message} />
        </span>
      )}

      <div
        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
          isMine
            ? 'bg-brand-600 rounded-bl-md text-white'
            : 'rounded-br-md border border-gray-100 bg-white text-gray-800'
        }`}
      >
        {!isMine && (
          <p className="text-brand-600 mb-0.5 text-[11px] font-bold">
            {message.sender?.fullName || message.sender?.phone || 'کاربر'}
          </p>
        )}

        <Attachment message={message} />

        {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}

        <div
          className={`mt-0.5 flex items-center gap-1 ${isMine ? 'justify-start' : 'justify-end'}`}
        >
          <span className={`text-[10px] ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
            {toPersianDigits(time)}
          </span>
        </div>
      </div>

      {!isMine && <Clock className="mb-1 hidden h-3 w-3 text-gray-300" />}
    </div>
  );
}

export const ChatMessageItem = memo(ChatMessageItemBase);
