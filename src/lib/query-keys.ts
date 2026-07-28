export const queryKeys = {
  agents: ['agents'] as const,
  agent: (id: string) => ['agents', id] as const,
  threads: ['threads'] as const,
  thread: (id: string) => ['threads', id] as const,
  runs: ['runs'] as const,
  tools: ['tools'] as const,
  tool: (id: string) => ['tools', id] as const,
};
