export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-24 text-center">
      <p className="text-ink-muted text-sm">{message}</p>
      {hint ? <p className="text-ink-faint text-xs">{hint}</p> : null}
    </div>
  );
}
