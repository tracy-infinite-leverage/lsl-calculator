import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @react-pdf/renderer ships pure JS + JSX; no native binary or font asset issues.
  // Silence the lockfile-inference warning by pinning Turbopack's root to /website.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
