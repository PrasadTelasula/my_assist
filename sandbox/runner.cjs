'use strict';
/*
 * Sandbox child entry. Lives outside src/ so Next never bundles it; invoked
 * per tool call by src/server/sandbox/execute.ts with one JSON job on stdin:
 *   { compiledJs, args, permissions, schemaOnly }
 * Emits one JSON line on stdout: { ok, result | error, durationMs }.
 * Module policy: only the '@sandbox/std' virtual module resolves, and its
 * fetchJson is enabled solely by the tool's stored network permission.
 */

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  raw += chunk;
});
process.stdin.on('end', () => {
  void main(raw);
});

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(0);
}

async function main(input) {
  const startedAt = Date.now();
  try {
    const { compiledJs, args, permissions = {}, schemaOnly = false } = JSON.parse(input);

    const std = {
      async fetchJson(url, init) {
        if (!permissions.net) {
          throw new Error('Network access is not enabled for this tool');
        }
        const response = await fetch(url, init);
        if (!response.ok) throw new Error(`fetchJson: ${url} responded ${response.status}`);
        return response.json();
      },
    };
    const sandboxRequire = (name) => {
      if (name === '@sandbox/std') return std;
      throw new Error(`Module '${name}' is not allowed in sandbox`);
    };

    const mod = { exports: {} };
    // eslint-disable-next-line no-new-func -- the sandbox boundary is the child process, not this scope
    new Function('module', 'exports', 'require', compiledJs)(mod, mod.exports, sandboxRequire);

    if (schemaOnly) {
      emit({ ok: true, result: mod.exports.schema, durationMs: Date.now() - startedAt });
      return;
    }

    const run = mod.exports.default;
    if (typeof run !== 'function') {
      throw new Error('Tool must export a default function');
    }
    const result = await run(args);
    emit({ ok: true, result, durationMs: Date.now() - startedAt });
  } catch (err) {
    emit({
      ok: false,
      error: err && err.message ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    });
  }
}
