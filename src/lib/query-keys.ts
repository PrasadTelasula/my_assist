export const queryKeys = {
  agents: ['agents'] as const,
  threads: ['threads'] as const,
  thread: (id: string) => ['threads', id] as const,
  runs: ['runs'] as const,
};
