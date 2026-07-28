import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';

export default function AgentsPage() {
  return (
    <>
      <PageHeader title="Agents" />
      <EmptyState
        message="No agents to show yet — agent management arrives in Phase 3."
        hint="Scout, the seeded starter agent, is already in the database."
      />
    </>
  );
}
