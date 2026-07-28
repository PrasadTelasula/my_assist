import type { RuntimeTool } from '@/core/loop';

/**
 * First-party tools that run in-process (they are our code, not user code).
 * User-authored tools arrive in Phase 2 and always execute in the sandbox.
 */
export function builtinTools(): RuntimeTool[] {
  return [
    {
      name: 'get_time',
      description: 'Get the current date and time (ISO 8601, UTC).',
      inputSchema: { type: 'object', properties: {} },
      toolVersionId: null,
      execute: async () => ({ output: new Date().toISOString() }),
    },
  ];
}
