import { describe, expect, it } from 'vitest';

import { validateToolSource } from '@/server/sandbox/validate';

const CLEAN_TOOL = `
export const schema = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
} as const;

export default async function run(input: { text: string }): Promise<unknown> {
  return { echoed: input.text.toUpperCase() };
}
`;

describe('validateToolSource', () => {
  it('accepts a clean tool', () => {
    const result = validateToolSource(CLEAN_TOOL, { net: false });
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('rejects module imports with the offending line', () => {
    const result = validateToolSource(`import fs from 'fs';\n${CLEAN_TOOL}`, { net: false });
    expect(result.ok).toBe(false);
    expect(result.issues[0]!.message).toMatch(/import.*not allowed/i);
    expect(result.issues[0]!.line).toBe(1);
  });

  it('rejects require calls', () => {
    const code = CLEAN_TOOL.replace(
      'return { echoed',
      "const cp = require('child_process');\n  return { echoed",
    );
    const result = validateToolSource(code, { net: false });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => /require.*not allowed/i.test(i.message))).toBe(true);
  });

  it('rejects dynamic import()', () => {
    const code = CLEAN_TOOL.replace('return { echoed', "await import('fs');\n  return { echoed");
    const result = validateToolSource(code, { net: false });
    expect(result.ok).toBe(false);
  });

  it('rejects references to process, eval, and Function', () => {
    for (const snippet of ['process.env.SECRET', "eval('1')", "new Function('return 1')()"]) {
      const code = CLEAN_TOOL.replace('return { echoed', `${snippet};\n  return { echoed`);
      const result = validateToolSource(code, { net: false });
      expect(result.ok, snippet).toBe(false);
    }
  });

  it('allows @sandbox/std only when the tool has network permission', () => {
    const code = `import { fetchJson } from '@sandbox/std';\n${CLEAN_TOOL}`;
    expect(validateToolSource(code, { net: false }).ok).toBe(false);
    expect(validateToolSource(code, { net: true }).ok).toBe(true);
  });

  it('requires a default function export and a schema export', () => {
    const noDefault = "export const schema = { type: 'object', properties: {} };";
    expect(validateToolSource(noDefault, { net: false }).ok).toBe(false);

    const noSchema = 'export default async function run() { return 1; }';
    expect(validateToolSource(noSchema, { net: false }).ok).toBe(false);
  });
});
