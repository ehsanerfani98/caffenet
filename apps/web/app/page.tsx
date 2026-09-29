import { redirect } from 'next/navigation';

/**
 * Root — customer app entry (7.4 home lives under /home).
 * Server-side redirect keeps the bottom-nav "خانه" tab on "/" working.
 */
export default function RootPage() {
  redirect('/home');
}
