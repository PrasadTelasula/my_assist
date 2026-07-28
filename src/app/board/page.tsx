import { EmptyState } from '@/components/shell/empty-state';
import { PageHeader } from '@/components/shell/page-header';

export default function BoardPage() {
  return (
    <>
      <PageHeader title="Board" />
      <EmptyState
        message="No sprints yet — the board arrives in Phase 4."
        hint="Sprints, stories, and agent assignees will live here."
      />
    </>
  );
}
