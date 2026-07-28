import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';

export default function ChatPage() {
  return (
    <>
      <PageHeader title="Chat" />
      <EmptyState
        message="No conversations yet — chat with a live trace arrives in Phase 1."
        hint="You will watch every tool call as it happens."
      />
    </>
  );
}
