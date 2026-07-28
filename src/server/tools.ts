import { asc, eq } from 'drizzle-orm';

import type { RuntimeTool } from '@/core/loop';
import { db } from '@/server/db/client';
import {
  agentTools,
  type Tool,
  type ToolPermissions,
  tools,
  type ToolVersion,
  toolVersions,
} from '@/server/db/schema';
import { compileToolSource } from '@/server/sandbox/compile';
import { executeInSandbox, extractToolSchema, type SandboxResult } from '@/server/sandbox/execute';
import { validateToolSource, type ValidationIssue } from '@/server/sandbox/validate';

export class ToolValidationError extends Error {
  constructor(public issues: ValidationIssue[]) {
    super(issues.map((i) => `${i.line}:${i.column} ${i.message}`).join('; '));
    this.name = 'ToolValidationError';
  }
}

interface ToolCodeInput {
  tsCode: string;
  permissions: ToolPermissions;
}

/** validate → compile → extract schema; throws ToolValidationError with diagnostics. */
async function buildVersion(input: ToolCodeInput) {
  const validation = validateToolSource(input.tsCode, input.permissions);
  if (!validation.ok) throw new ToolValidationError(validation.issues);
  const compiledJs = await compileToolSource(input.tsCode);
  let inputSchema: Record<string, unknown>;
  try {
    inputSchema = await extractToolSchema(compiledJs);
  } catch (err) {
    throw new ToolValidationError([
      { message: err instanceof Error ? err.message : String(err), line: 1, column: 1 },
    ]);
  }
  return { compiledJs, inputSchema };
}

export async function createTool(input: {
  name: string;
  description: string;
  tsCode: string;
  permissions: ToolPermissions;
}): Promise<Tool & { latestVersion: ToolVersion }> {
  const { compiledJs, inputSchema } = await buildVersion(input);

  const [tool] = await db
    .insert(tools)
    .values({ name: input.name, description: input.description })
    .returning();
  const [version] = await db
    .insert(toolVersions)
    .values({
      toolId: tool!.id,
      version: 1,
      tsCode: input.tsCode,
      compiledJs,
      inputSchema,
      permissions: input.permissions,
    })
    .returning();
  await db.update(tools).set({ latestVersionId: version!.id }).where(eq(tools.id, tool!.id));

  return { ...tool!, latestVersionId: version!.id, latestVersion: version! };
}

export async function saveToolVersion(toolId: string, input: ToolCodeInput): Promise<ToolVersion> {
  const tool = await db.query.tools.findFirst({ where: eq(tools.id, toolId) });
  if (!tool) throw new Error(`Tool not found: ${toolId}`);
  const { compiledJs, inputSchema } = await buildVersion(input);

  const existing = await db.query.toolVersions.findMany({
    where: eq(toolVersions.toolId, toolId),
    orderBy: asc(toolVersions.version),
  });
  const nextVersion = (existing.at(-1)?.version ?? 0) + 1;

  const [version] = await db
    .insert(toolVersions)
    .values({
      toolId,
      version: nextVersion,
      tsCode: input.tsCode,
      compiledJs,
      inputSchema,
      permissions: input.permissions,
    })
    .returning();
  await db.update(tools).set({ latestVersionId: version!.id }).where(eq(tools.id, toolId));
  return version!;
}

export async function testRunTool(toolId: string, args: unknown): Promise<SandboxResult> {
  const tool = await db.query.tools.findFirst({ where: eq(tools.id, toolId) });
  if (!tool?.latestVersionId) throw new Error(`Tool not found: ${toolId}`);
  const version = await db.query.toolVersions.findFirst({
    where: eq(toolVersions.id, tool.latestVersionId),
  });
  return executeInSandbox({
    compiledJs: version!.compiledJs,
    args,
    permissions: version!.permissions,
  });
}

/**
 * The agent's user tools as loop-ready RuntimeTools, resolved to each tool's
 * latest version at call time — runs snapshot these once at start, which is
 * exactly the version-pinning semantics.
 */
export async function userToolsForAgent(agentId: string): Promise<RuntimeTool[]> {
  const rows = await db
    .select({
      name: tools.name,
      description: tools.description,
      versionId: toolVersions.id,
      inputSchema: toolVersions.inputSchema,
      compiledJs: toolVersions.compiledJs,
      permissions: toolVersions.permissions,
    })
    .from(agentTools)
    .innerJoin(tools, eq(agentTools.toolId, tools.id))
    .innerJoin(toolVersions, eq(tools.latestVersionId, toolVersions.id))
    .where(eq(agentTools.agentId, agentId));

  return rows.map((row) => ({
    name: row.name,
    description: row.description,
    inputSchema: row.inputSchema,
    toolVersionId: row.versionId,
    execute: async (input: unknown) => {
      const result = await executeInSandbox({
        compiledJs: row.compiledJs,
        args: input,
        permissions: row.permissions,
      });
      return result.ok
        ? { output: result.result }
        : { output: result.error ?? 'Tool failed', isError: true };
    },
  }));
}
