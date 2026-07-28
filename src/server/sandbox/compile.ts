import ts from 'typescript';

/** TS → CJS for the sandbox runner. Pure-JS transpile — no native toolchain. */
export async function compileToolSource(source: string): Promise<string> {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  return result.outputText;
}
