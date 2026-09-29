/**
 * Type declarations for untyped third-party packages (Phase 5).
 */
declare module 'arabic-persian-reshaper' {
  export const ArabicShaper: {
    /**
     * Convert Arabic/Persian letters to their contextual presentation forms
     * so non-shaping renderers (pdfkit) can draw connected script.
     */
    convertArabic(text: string): string;
    removeFromArabic(text: string): string;
  };
}
