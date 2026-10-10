import type { Metadata } from 'next';
import './globals.css';
import { ClubShell } from '@/components/club/shell';
import { ClubFeedbackProvider } from '@/components/club/feedback';
import { currentRole } from '@/server/auth';
export const metadata: Metadata = { title: 'Skyline Student Association', description: 'Members, events and campus life, in one place.' };
export default async function RootLayout({ children }: Readonly<{
    children: React.ReactNode;
}>) { const role = await currentRole(); return <html lang="en"><body><ClubFeedbackProvider><ClubShell role={role}>{children}</ClubShell></ClubFeedbackProvider></body></html>; }
