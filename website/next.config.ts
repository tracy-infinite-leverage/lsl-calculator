import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @react-pdf/renderer ships pure JS + JSX; no native binary or font asset issues.
  // Silence the lockfile-inference warning by pinning Turbopack's root to /website.
  turbopack: {
    root: __dirname,
  },
  // pdfjs-dist resolves its worker at runtime via a relative `import()` that
  // Turbopack rewrites and breaks ("Cannot find module .../pdf.worker.mjs").
  // Treating it as a server-external package keeps it as a normal Node require
  // at runtime — pdfjs finds its own worker from its own node_modules dir.
  serverExternalPackages: ['pdfjs-dist'],
};

export default nextConfig;
