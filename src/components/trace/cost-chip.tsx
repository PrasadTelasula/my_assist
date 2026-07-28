export function CostChip({ costUsd }: { costUsd: number | string | null }) {
  const value = costUsd === null ? null : typeof costUsd === 'string' ? Number(costUsd) : costUsd;
  return (
    <span className="rounded-control bg-surface-muted text-ink-muted px-1.5 py-0.5 font-mono text-[11px]">
      {value === null ? '$ —' : `$${value.toFixed(4)}`}
    </span>
  );
}
