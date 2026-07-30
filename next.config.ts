import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // AST/transpile tooling used by the tool sandbox must not be bundled.
  serverExternalPackages: ['typescript'],
  // The dev badge parks itself over the sidebar's Settings link.
  devIndicators: false,
};

export default nextConfig;
