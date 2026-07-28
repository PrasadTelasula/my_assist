import ts from 'typescript';

export interface ValidationIssue {
  message: string;
  line: number;
  column: number;
}

interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const SANDBOX_STD = '@sandbox/std';
const BANNED_IDENTIFIERS = new Set([
  'process',
  'eval',
  'Function',
  'globalThis',
  '__dirname',
  '__filename',
  'require',
]);

/**
 * Save-time gate for user-authored tool code. Static analysis is defense in
 * depth, not the security boundary — the child-process runner enforces the
 * same module policy at runtime.
 */
export function validateToolSource(
  source: string,
  permissions: { net: boolean },
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const file = ts.createSourceFile('tool.ts', source, ts.ScriptTarget.ES2022, true);

  const report = (node: ts.Node, message: string) => {
    const { line, character } = file.getLineAndCharacterOfPosition(node.getStart());
    issues.push({ message, line: line + 1, column: character + 1 });
  };

  const checkModuleName = (node: ts.Node, name: string) => {
    if (name === SANDBOX_STD) {
      if (!permissions.net) {
        report(node, `Import of '${SANDBOX_STD}' requires the tool's network permission`);
      }
      return;
    }
    report(node, `Import of '${name}' is not allowed in sandboxed tools`);
  };

  let hasDefaultExport = false;
  let hasSchemaExport = false;

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      checkModuleName(node, node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        report(node, 'Dynamic import() is not allowed in sandboxed tools');
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        report(node, 'require() is not allowed in sandboxed tools');
      }
    } else if (ts.isIdentifier(node) && BANNED_IDENTIFIERS.has(node.text)) {
      // Only flag real references — not property names (`a.process`) or declarations.
      const parent = node.parent;
      const isPropertyName =
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node);
      const isDeclarationName =
        (ts.isVariableDeclaration(parent) || ts.isParameter(parent)) && parent.name === node;
      const isRequireCallee =
        ts.isCallExpression(parent) && parent.expression === node && node.text === 'require';
      if (!isPropertyName && !isDeclarationName && !isRequireCallee) {
        report(node, `'${node.text}' is not available in sandboxed tools`);
      }
    }

    if (ts.isExportAssignment(node)) hasDefaultExport = true;
    if (
      (ts.isFunctionDeclaration(node) || ts.isVariableStatement(node)) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      if (node.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
        hasDefaultExport = true;
      }
      if (
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (d) => ts.isIdentifier(d.name) && d.name.text === 'schema',
        )
      ) {
        hasSchemaExport = true;
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(file);

  if (!hasDefaultExport) {
    issues.push({ message: 'Tool must have a default function export', line: 1, column: 1 });
  }
  if (!hasSchemaExport) {
    issues.push({ message: "Tool must export a 'schema' JSON Schema object", line: 1, column: 1 });
  }

  return { ok: issues.length === 0, issues };
}
