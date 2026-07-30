import type { RuntimeTool, ToolExecutionResult } from './loop';

export interface DispatchOutcome extends ToolExecutionResult {
  isError: boolean;
}

/**
 * Runs a tool by name and never throws: a failing tool is a result the model
 * can read and recover from, not a crashed run. Shared by both tool modes.
 */
export function makeDispatcher(tools: RuntimeTool[]) {
  const byName = new Map(tools.map((t) => [t.name, t]));

  return async function dispatch(toolName: string, input: unknown): Promise<DispatchOutcome> {
    const runtimeTool = byName.get(toolName);
    if (!runtimeTool) {
      // Name what exists — a model that invented a tool otherwise apologizes
      // and guesses again, burning iterations.
      const available = tools.map((t) => t.name).join(', ') || 'none';
      return {
        output: `Unknown tool: ${toolName}. Available tools: ${available}. Answer directly instead.`,
        isError: true,
      };
    }
    try {
      const result = await runtimeTool.execute(input);
      return { output: result.output, isError: result.isError ?? false };
    } catch (err) {
      return { output: err instanceof Error ? err.message : String(err), isError: true };
    }
  };
}
