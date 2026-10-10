/** @type {import('next').NextConfig} */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  distDir: process.env.SKYLINE_DIST_DIR || '.next',
  experimental: {
    outputFileTracingRoot: appRoot,
    serverActions: { bodySizeLimit: '2mb' },
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(appRoot, 'src');
    return config;
  },
};
export default nextConfig;
