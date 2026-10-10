'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from '@/server/actions/auth';
import { LayoutDashboard, Users, CalendarDays, ShoppingBag, Columns3, Wallet, Megaphone, Menu, X, ArrowUpRight } from 'lucide-react';
const navigation = [{ href: '/', name: 'Overview', icon: LayoutDashboard }, { href: '/members', name: 'Members', icon: Users }, { href: '/events', name: 'Events & tickets', icon: CalendarDays }, { href: '/merchandise', name: 'Club shop', icon: ShoppingBag }, { href: '/fundraisers', name: 'Volunteer board', icon: Columns3 }, { href: '/treasurer', name: 'Treasurer', icon: Wallet }, { href: '/announcements', name: 'Noticeboard', icon: Megaphone }];
export function ClubShell({ children, role }: {
    children: React.ReactNode;
    role: string;
}) {
    const path = usePathname();
    const [open, setOpen] = useState(false);
    useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === 'Escape')
        setOpen(false); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
    if (path === '/login')
        return <>{children}</>;
    const current = navigation.find(item => item.href === '/' ? path === '/' : path.startsWith(item.href));
    return <div className="club-app">{open && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)}/>}
 <aside className={`club-sidebar ${open ? 'is-open' : ''}`}><button className="mobile-sidebar-close icon-button" aria-label="Close sidebar" onClick={() => setOpen(false)}><X size={18}/></button><Link href="/" className="club-brand" onClick={() => setOpen(false)}><span className="brand-symbol">s.</span><span>skyline<span className="brand-caption">STUDENT ASSOCIATION</span></span></Link><div className="sidebar-label">YOUR CLUB SPACE</div><nav aria-label="Main navigation">{navigation.map(({ href, name, icon: Icon }) => { const active = href === '/' ? path === '/' : path.startsWith(href); return <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? 'page' : undefined} className={`nav-item ${active ? 'active' : ''}`}><Icon size={18} strokeWidth={1.7}/>{name}{active && <span className="nav-dot"/>}</Link>; })}</nav><div className="sidebar-note"><span className="badge">Practice workspace</span><p>A little less admin.<br />A little more campus life.</p><Link href="/login">Switch your role <ArrowUpRight size={15}/></Link></div><div className="sidebar-footer"><span className="avatar small">{role.charAt(0)}</span><div><strong>{role.charAt(0) + role.slice(1).toLowerCase()} desk</strong><span>Role-based practice access</span></div></div></aside>
 <div className="club-content"><header className="club-topbar"><div className="flex items-center gap-3"><button className="icon-button mobile-menu" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20}/> : <Menu size={20}/>}</button><span className="text-muted">Workspace</span><span className="text-muted">/</span><strong>{current?.name ?? 'Skyline'}</strong></div><div className="flex items-center gap-5"><Link href="/announcements" className="topbar-link"><Megaphone size={16}/><span>Club updates</span></Link><form action={signOut}><button className="text-xs text-muted hover:text-[#243e36]">Leave desk</button></form></div></header><div className="page-container">{children}</div><footer className="club-footer">Skyline Student Association <span>Practice workspace · Payments are recorded locally, not charged.</span></footer></div></div>;
}

