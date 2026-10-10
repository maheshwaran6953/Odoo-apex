/** @type {import('next').NextConfig} */
import path from 'node:path';

const nextConfig = {
  distDir: process.env.SKYLINE_DIST_DIR || '.next',
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(process.cwd(), 'src');
    return config;
  },
};
export default nextConfig;
