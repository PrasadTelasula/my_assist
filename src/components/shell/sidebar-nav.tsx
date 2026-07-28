'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/board', label: 'Board' },
  { href: '/agents', label: 'Agents' },
  { href: '/chat', label: 'Chat' },
  { href: '/runs', label: 'Runs' },
  { href: '/ops', label: 'Ops' },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="border-edge bg-surface flex w-52 shrink-0 flex-col border-r">
      <Link href="/board" className="flex items-center gap-2 px-5 py-5">
        <span className="bg-accent-600 size-2.5 rounded-full" aria-hidden />
        <span className="text-ink text-sm font-semibold tracking-tight">my_assist</span>
      </Link>
      <nav className="flex flex-col gap-0.5 px-3" aria-label="Primary">
        {links.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-control px-2.5 py-1.5 text-sm transition-colors ${
                active
                  ? 'bg-accent-600/10 text-accent-500 font-medium'
                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
