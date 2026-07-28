import { describe, expect, it } from 'vitest';

import { compileToolSource } from '@/server/sandbox/compile';
import { executeInSandbox, extractToolSchema } from '@/server/sandbox/execute';

const ECHO_TOOL = `
export const schema = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
};

export default async function run(input: { text: string }) {
  return { echoed: input.text.toUpperCase() };
}
`;

describe('sandbox execution', () => {
  it('round-trips JSON through a child process', async () => {
    const compiledJs = await compileToolSource(ECHO_TOOL);
    const result = await executeInSandbox({ compiledJs, args: { text: 'hi' } });
    expect(result.ok).toBe(true);
    expect(result.result).toEqual({ echoed: 'HI' });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('kills an infinite loop at the timeout', async () => {
    const compiledJs = await compileToolSource(
      `export const schema = { type: 'object', properties: {} };
       export default async function run() { for (;;) {} }`,
    );
    const started = Date.now();
    const result = await executeInSandbox({ compiledJs, args: {}, timeoutMs: 2000 });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/timed out/i);
    expect(Date.now() - started).toBeLessThan(8000);
  }, 15_000);

  it('reports a throwing tool as an error, not a crash', async () => {
    const compiledJs = await compileToolSource(
      `export const schema = { type: 'object', properties: {} };
       export default async function run() { throw new Error('tool exploded'); }`,
    );
    const result = await executeInSandbox({ compiledJs, args: {} });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('tool exploded');
  });

  it('blocks disallowed require at runtime as defense in depth', async () => {
    // Bypasses save-time validation on purpose: hand-built CJS calling require.
    const compiledJs = `module.exports.default = async () => require('fs').readdirSync('/');
      module.exports.schema = { type: 'object', properties: {} };`;
    const result = await executeInSandbox({ compiledJs, args: {} });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not allowed in sandbox/i);
  });

  it('extracts the exported schema and rejects non-portable ones', async () => {
    const compiledJs = await compileToolSource(ECHO_TOOL);
    const schema = await extractToolSchema(compiledJs);
    expect(schema).toMatchObject({ type: 'object', required: ['text'] });

    const refSchema = await compileToolSource(
      `export const schema = { type: 'object', properties: { x: { $ref: '#/defs/x' } } };
       export default async function run() { return 1; }`,
    );
    await expect(extractToolSchema(refSchema)).rejects.toThrow(/portable|\$ref/i);
  });
});
