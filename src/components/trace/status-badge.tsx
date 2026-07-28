const STYLES: Record<string, string> = {
  running: 'bg-info/10 text-info',
  queued: 'bg-info/10 text-info',
  succeeded: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
  aborted: 'bg-warning/10 text-warning',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-control inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium ${
        STYLES[status] ?? 'bg-surface-muted text-ink-muted'
      }`}
    >
      {status === 'running' ? (
        <span className="bg-info size-1.5 animate-pulse rounded-full" aria-hidden />
      ) : null}
      {status}
    </span>
  );
}
