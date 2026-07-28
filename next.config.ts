import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // AST/transpile tooling used by the tool sandbox must not be bundled.
  serverExternalPackages: ['typescript'],
};

export default nextConfig;
