export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="border-edge bg-surface flex items-center justify-between border-b px-6 py-4">
      <h1 className="text-ink text-base font-semibold tracking-tight">{title}</h1>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </header>
  );
}
