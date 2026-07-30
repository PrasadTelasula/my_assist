'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from './theme-toggle';

const GROUPS = [
  { label: 'Work', links: [{ href: '/board', label: 'Board' }] },
  {
    label: 'Build',
    links: [
      { href: '/agents', label: 'Agents' },
      { href: '/chat', label: 'Chat' },
    ],
  },
  {
    label: 'Observe',
    links: [
      { href: '/runs', label: 'Runs' },
      { href: '/ops', label: 'Ops' },
    ],
  },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="border-edge bg-surface flex w-56 shrink-0 flex-col border-r">
      <Link href="/board" className="flex items-center gap-2.5 px-5 py-5">
        <span className="bg-accent-600 rounded-control grid size-7 place-items-center text-[13px] font-bold text-white">
          m
        </span>
        <span className="text-ink text-[15px] font-semibold tracking-tight">my_assist</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-5 px-3 py-2" aria-label="Primary">
        {GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <p className="text-ink-faint px-2.5 pb-1 text-[10px] font-semibold tracking-widest uppercase">
              {group.label}
            </p>
            {group.links.map(({ href, label }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-control relative px-2.5 py-1.5 text-sm transition-colors ${
                    active
                      ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium'
                      : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                  }`}
                >
                  {active ? (
                    <span className="bg-accent-500 absolute top-1.5 bottom-1.5 -left-3 w-0.5 rounded-full" />
                  ) : null}
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-edge flex items-center justify-between border-t px-3 py-2.5">
        <Link
          href="/settings"
          className={`rounded-control px-2.5 py-1.5 text-sm transition-colors ${
            pathname.startsWith('/settings')
              ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400 font-medium'
              : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
          }`}
        >
          Settings
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  );
}
