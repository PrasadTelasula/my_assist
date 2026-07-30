export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-edge bg-surface sticky top-0 z-10 flex items-center justify-between gap-4 border-b px-6 py-3.5">
      <div className="min-w-0">
        <h1 className="text-ink truncate text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-ink-faint mt-0.5 truncate text-xs">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  );
}
