export function EmptyState({
  message,
  hint,
  action,
}: {
  message: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-24 text-center">
      <span
        aria-hidden
        className="border-edge bg-surface text-ink-faint mb-1 grid size-10 place-items-center rounded-full border text-lg"
      >
        ○
      </span>
      <p className="text-ink text-sm font-medium">{message}</p>
      {hint ? <p className="text-ink-muted max-w-sm text-xs leading-relaxed">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
