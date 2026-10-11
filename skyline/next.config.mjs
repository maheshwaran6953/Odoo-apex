/** @type {import('next').NextConfig} */
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  distDir: process.env.SKYLINE_DIST_DIR || ".next",
  outputFileTracingRoot: appRoot,
  poweredByHeader: false,
  experimental: {
    // Bound build workers so local compilation fits developer laptops.
    cpus: 1,
    serverActions: { bodySizeLimit: "3mb" },
  },
  webpack: (config) => {
    config.resolve.alias["@"] = path.join(appRoot, "src");
    return config;
  },
};
export default nextConfig;
