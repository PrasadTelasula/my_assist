import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';

export default function OpsPage() {
  return (
    <>
      <PageHeader title="Ops" />
      <EmptyState
        message="Nothing to report — cost and usage rollups arrive in Phase 6."
        hint="Spend by agent and by day, failures, and provider key status."
      />
    </>
  );
}
