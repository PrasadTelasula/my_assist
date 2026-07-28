import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import path from 'node:path';

import { Ajv } from 'ajv';

interface SandboxJob {
  compiledJs: string;
  args?: unknown;
  permissions?: { net?: boolean };
  timeoutMs?: number;
  schemaOnly?: boolean;
}

export interface SandboxResult {
  ok: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
  stderr?: string;
}

const RUNNER_PATH = path.join(process.cwd(), 'sandbox', 'runner.cjs');
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 60_000;
const OUTPUT_CAP_BYTES = 256 * 1024;
const STDERR_CAP_BYTES = 8 * 1024;

/**
 * Runs user tool code out of process: fresh Node child per invocation, memory
 * capped, wall-clock timeout with a process-group kill so grandchildren die
 * too. A guardrail for locally-authored code — not hostile-tenant isolation.
 */
export function executeInSandbox(job: SandboxJob): Promise<SandboxResult> {
  const timeoutMs = Math.min(job.timeoutMs ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);

  return new Promise((resolve) => {
    const child: ChildProcessWithoutNullStreams = spawn(
      process.execPath,
      ['--max-old-space-size=128', RUNNER_PATH],
      // Minimal env: the child must not inherit DATABASE_URL or provider keys.
      { detached: true, env: { PATH: process.env.PATH ?? '', NODE_ENV: 'production' } },
    );

    let stdout = '';
    let stderr = '';
    let settled = false;

    const settle = (result: SandboxResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, stderr: stderr.slice(0, STDERR_CAP_BYTES) || undefined });
    };

    const timer = setTimeout(() => {
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch {
        // process group already gone
      }
      settle({ ok: false, error: `Tool timed out after ${timeoutMs}ms`, durationMs: timeoutMs });
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < OUTPUT_CAP_BYTES) stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < STDERR_CAP_BYTES) stderr += chunk.toString();
    });

    child.on('error', (err) => {
      settle({ ok: false, error: `Sandbox failed to start: ${err.message}`, durationMs: 0 });
    });

    child.on('close', (code) => {
      const lastLine = stdout.trim().split('\n').at(-1) ?? '';
      try {
        settle(JSON.parse(lastLine) as SandboxResult);
      } catch {
        settle({
          ok: false,
          error: `Sandbox exited (code ${code}) without a result`,
          durationMs: 0,
        });
      }
    });

    child.stdin.write(JSON.stringify(job));
    child.stdin.end();
  });
}

const PORTABLE_BANNED_KEYS = ['$ref', 'oneOf', 'allOf', 'anyOf', 'not'];

function assertPortable(schema: unknown, path0 = 'schema'): void {
  if (Array.isArray(schema)) {
    schema.forEach((item, i) => assertPortable(item, `${path0}[${i}]`));
    return;
  }
  if (schema && typeof schema === 'object') {
    for (const [key, value] of Object.entries(schema)) {
      if (PORTABLE_BANNED_KEYS.includes(key)) {
        throw new Error(
          `${path0}.${key} is not portable across providers — use a flat object schema (no ${key})`,
        );
      }
      assertPortable(value, `${path0}.${key}`);
    }
  }
}

/** Reads the tool's exported schema by evaluating it inside the sandbox. */
export async function extractToolSchema(compiledJs: string): Promise<Record<string, unknown>> {
  const result = await executeInSandbox({ compiledJs, schemaOnly: true, timeoutMs: 5000 });
  if (!result.ok) throw new Error(`Could not read tool schema: ${result.error}`);
  const schema = result.result;
  if (!schema || typeof schema !== 'object' || (schema as { type?: string }).type !== 'object') {
    throw new Error("Tool schema must be a JSON Schema object with type: 'object'");
  }
  assertPortable(schema);
  const ajv = new Ajv({ strict: false });
  if (!ajv.validateSchema(schema)) {
    throw new Error(`Tool schema is not valid JSON Schema: ${ajv.errorsText(ajv.errors)}`);
  }
  return schema as Record<string, unknown>;
}
