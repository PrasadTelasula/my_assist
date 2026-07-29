import { FlatCompat } from '@eslint/eslintrc';
import boundaries from 'eslint-plugin-boundaries';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'core', pattern: 'src/core/**' },
        { type: 'server', pattern: 'src/server/**' },
        { type: 'app', pattern: 'src/app/**' },
        { type: 'components', pattern: 'src/components/**' },
        { type: 'lib', pattern: 'src/lib/**' },
      ],
    },
    rules: {
      // Architecture: one-way dependency flow (see CONVENTIONS.md).
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'core', allow: ['core'] },
            { from: 'server', allow: ['server', 'core'] },
            { from: 'app', allow: ['app', 'server', 'core', 'components', 'lib'] },
            { from: 'components', allow: ['components', 'lib', 'core'] },
            { from: 'lib', allow: ['lib', 'core'] },
          ],
        },
      ],
      'max-lines': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // The schema is deliberately one file: tables reference each other's columns
    // for foreign keys, and splitting it would introduce import cycles for no
    // readability gain. It still does the one thing its name says.
    files: ['src/server/db/schema.ts'],
    rules: { 'max-lines': 'off' },
  },
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'drizzle/**'],
  },
];

export default eslintConfig;
