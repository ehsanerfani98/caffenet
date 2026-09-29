import { getRequestConfig } from 'next-intl/server';

/**
 * next-intl request config (Phase 1 placeholder — full i18n in Phase 7).
 * Default locale: fa (Persian, RTL). Messages are provided per-namespace later.
 */
export default getRequestConfig(async () => ({
  locale: 'fa',
  messages: {},
}));
