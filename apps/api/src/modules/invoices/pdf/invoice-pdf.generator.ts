import { readFile } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { ArabicShaper } from 'arabic-persian-reshaper';
import bidiFactory from 'bidi-js';
import { INVOICE_CONFIG } from '@caffenet/shared';

/**
 * Invoice PDF generator (Phase 5.4.5).
 *
 * Persian/RTL rendering pipeline (pdfkit does NOT shape Arabic script):
 *   1. ZWNJ → space (pdfkit cannot join across zero-width non-joiners)
 *   2. ArabicPersianReshaper → maps letters to contextual presentation forms
 *   3. bidi-js → reorders the shaped string to VISUAL order (base RTL)
 *   4. Vazirmatn font (OFL, committed under assets/fonts) → Persian glyphs
 *
 * Layout (RTL invoice):
 *   - LABELS in the RIGHT column (Persian reads right→left)
 *   - VALUES in the LEFT column (Latin numbers / mixed text, shaped as needed)
 *   - Line items: label right, amount left; bold totals block at the bottom
 *
 * Graceful degradation: without the font file, falls back to Helvetica with
 * Persian glyphs stripped (labels switch to English) — never throws.
 */

const bidi = bidiFactory();

export interface InvoicePdfData {
  invoiceNumber: string;
  createdAt: Date;
  paidAt?: Date | null;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  trackingCode: string;
  serviceName?: string | null;
  currency: string;
  laborFee: number; // Toman (major)
  materialCost: number;
  additionalCost: number;
  discountAmount: number;
  finalTotal: number;
  items: Array<{ type: string; description: string; amount: number }>;
}

const FONT_CANDIDATES = [
  'assets/fonts/Vazirmatn-Regular.ttf',
  '../assets/fonts/Vazirmatn-Regular.ttf',
];

export class InvoicePdfGenerator {
  private static regularFont: Buffer | null | undefined;
  private static boldFont: Buffer | null | undefined;

  /** Load Vazirmatn once per process; null → fallback mode (Helvetica/EN). */
  private static async loadFonts(): Promise<void> {
    if (InvoicePdfGenerator.regularFont !== undefined) return;
    for (const rel of FONT_CANDIDATES) {
      try {
        InvoicePdfGenerator.regularFont = await readFile(path.resolve(process.cwd(), rel));
        InvoicePdfGenerator.boldFont = await readFile(
          path.resolve(process.cwd(), rel.replace('Regular', 'Bold')),
        );
        return;
      } catch {
        // try next candidate
      }
    }
    InvoicePdfGenerator.regularFont = null;
    InvoicePdfGenerator.boldFont = null;
  }

  private static hasPersian(text: string): boolean {
    return /[\u0600-\u06FF]/.test(text);
  }

  /** ZWNJ→space, shape presentation forms, bidi-reorder to visual order. */
  private static shape(text: string): string {
    const normalized = text.replace(/\u200C/g, ' ');
    if (!InvoicePdfGenerator.hasPersian(normalized)) return normalized;
    const reshaped = ArabicShaper.convertArabic(normalized);
    const levels = bidi.getEmbeddingLevels(reshaped, 'rtl');
    return bidi.getReorderedString(reshaped, levels);
  }

  private static money(amount: number): string {
    return amount.toLocaleString('en-US');
  }

  /** Persian (Jalali) date with Latin digits — shape() handles the month name. */
  private static faDate(d: Date): string {
    try {
      return new Intl.DateTimeFormat('fa-IR-u-nu-latn', { dateStyle: 'long' }).format(d);
    } catch {
      return d.toISOString().slice(0, 10);
    }
  }

  static async generate(data: InvoicePdfData): Promise<Buffer> {
    await InvoicePdfGenerator.loadFonts();
    const hasFa = InvoicePdfGenerator.regularFont !== null;

    const doc = new PDFDocument({ size: 'A4', margin: INVOICE_CONFIG.PDF_PAGE_MARGIN });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    const M = INVOICE_CONFIG.PDF_PAGE_MARGIN;
    const W = doc.page.width - M * 2;
    const L = (fa: string, en: string) => (hasFa ? fa : en);

    const setFont = (bold = false) => {
      try {
        if (hasFa) {
          doc.font(bold ? InvoicePdfGenerator.boldFont! : InvoicePdfGenerator.regularFont!);
        } else {
          doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
        }
      } catch {
        doc.font('Helvetica');
      }
    };

    /** Full-width line, centered/right, optionally bold. */
    const line = (
      text: string,
      opts: { align?: 'center' | 'right' | 'left'; bold?: boolean; size?: number } = {},
    ) => {
      setFont(Boolean(opts.bold));
      doc.fontSize(opts.size ?? 10);
      doc.text(
        hasFa ? InvoicePdfGenerator.shape(text) : text.replace(/[\u0600-\u06FF]/g, ''),
        M,
        doc.y,
        {
          width: W,
          align: opts.align ?? 'right',
        },
      );
    };

    /** Label (right column) + value (left column) on one visual row. */
    const row = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}) => {
      const size = opts.size ?? 10;
      setFont(Boolean(opts.bold));
      doc.fontSize(size);
      const y0 = doc.y;
      const labelW = W * 0.55;
      const valueW = W - labelW;
      const l = hasFa ? InvoicePdfGenerator.shape(label) : label.replace(/[\u0600-\u06FF]/g, '');
      const v = hasFa ? InvoicePdfGenerator.shape(value) : value.replace(/[\u0600-\u06FF]/g, '');
      if (l) doc.text(l, M + W - labelW, y0, { width: labelW, align: 'right', lineBreak: false });
      if (v) doc.text(v, M, y0, { width: valueW, align: 'left', lineBreak: false });
      doc.y = y0 + size + 7;
    };

    const hr = () => {
      doc
        .moveTo(M, doc.y)
        .lineTo(M + W, doc.y)
        .lineWidth(0.75)
        .strokeColor('#cbd5e1')
        .stroke();
      doc.y += 12;
    };

    // ==================== HEADER ====================
    line(L('فاکتور خدمت', 'Service Invoice'), { align: 'center', bold: true, size: 18 });
    doc.fontSize(9).fillColor('#64748b');
    line(L('پلتفرم خدمات کافی نت — Caffenet', 'Internet Cafe Service Platform — Caffenet'), {
      align: 'center',
    });
    doc.fillColor('#000000');
    doc.y += 6;
    hr();

    // ==================== META ====================
    row(L('شماره فاکتور', 'Invoice No.') + ':', data.invoiceNumber);
    row(L('تاریخ صدور', 'Issued') + ':', InvoicePdfGenerator.faDate(data.createdAt));
    if (data.paidAt) {
      row(L('تاریخ پرداخت', 'Paid') + ':', InvoicePdfGenerator.faDate(data.paidAt));
      row(L('وضعیت', 'Status') + ':', L('پرداخت شده', 'PAID'));
    } else {
      row(L('وضعیت', 'Status') + ':', L('صادر شده — در انتظار پرداخت', 'Issued'));
    }
    hr();

    // ==================== CUSTOMER + REQUEST ====================
    row(L('مشتری', 'Customer') + ':', data.customerName ?? '—');
    row(L('تلفن', 'Phone') + ':', data.customerPhone ?? '—');
    row(L('کد رهگیری درخواست', 'Tracking Code') + ':', data.trackingCode);
    row(L('خدمت', 'Service') + ':', data.serviceName ?? '—');
    hr();

    // ==================== LINE ITEMS ====================
    const itemLabel = (type: string): string => {
      switch (type) {
        case 'labor':
          return L('دستمزد خدمت', 'Labor fee');
        case 'material':
          return L('هزینه مواد', 'Material cost');
        case 'additional':
          return L('هزینه های تکمیلی', 'Additional costs');
        case 'discount':
          return L('تخفیف', 'Discount');
        default:
          return type;
      }
    };

    const itemRows = data.items.length
      ? data.items
      : [
          { type: 'labor', description: 'labor', amount: data.laborFee },
          { type: 'material', description: 'material', amount: data.materialCost },
          { type: 'additional', description: 'additional', amount: data.additionalCost },
          { type: 'discount', description: 'discount', amount: -data.discountAmount },
        ].filter((i) => (i.type === 'discount' ? data.discountAmount > 0 : i.amount > 0));

    for (const item of itemRows) {
      const sign = item.amount < 0 ? '− ' : '';
      row(itemLabel(item.type), `${sign}${InvoicePdfGenerator.money(Math.abs(item.amount))}`);
    }
    hr();

    // ==================== TOTALS ====================
    row(
      L('جمع کل', 'Subtotal') + ':',
      InvoicePdfGenerator.money(data.laborFee + data.materialCost + data.additionalCost),
    );
    if (data.discountAmount > 0) {
      row(L('تخفیف', 'Discount') + ':', `− ${InvoicePdfGenerator.money(data.discountAmount)}`);
    }
    doc.y += 4;
    setFont(true);
    doc.fontSize(13);
    doc.text(
      hasFa
        ? InvoicePdfGenerator.shape(
            `${L('مبلغ نهایی', 'Final Total')}: ${InvoicePdfGenerator.money(data.finalTotal)} تومان`,
          )
        : `${L('Final Total', 'Final Total')}: ${InvoicePdfGenerator.money(data.finalTotal)} Toman`,
      M,
      doc.y,
      { width: W, align: 'right' },
    );
    doc.y += 18;
    hr();

    // ==================== FOOTER ====================
    doc.fontSize(8).fillColor('#94a3b8');
    line(
      L(
        'این فاکتور به صورت خودکار توسط سامانه Caffenet صادر شده است.',
        'This invoice was generated automatically by Caffenet.',
      ),
      { align: 'center' },
    );
    doc.fillColor('#000000');

    doc.end();
    return done;
  }
}
