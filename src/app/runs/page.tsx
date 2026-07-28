import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';

export default function RunsPage() {
  return (
    <>
      <PageHeader title="Runs" />
      <EmptyState
        message="No runs yet — assign a task to an agent or start a chat."
        hint="Every run records its full trace: iterations, tool calls, tokens, cost."
      />
    </>
  );
}
