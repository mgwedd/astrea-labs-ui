import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@astrea/ui', '@astrea/research-registry'],
};

export default nextConfig;
