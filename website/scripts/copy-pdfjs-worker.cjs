#!/usr/bin/env node
/**
 * postinstall: copy pdf.worker.min.mjs from node_modules to /public/ so it can
 * be served from the same origin. pdfjs-dist v5 requires a worker URL at runtime
 * (disableWorker is not supported in the build we ship), and Turbopack doesn't
 * resolve the Vite/Webpack-style `?url` import pattern. Static-file copy is the
 * portable approach.
 */
const fs = require('node:fs');
const path = require('node:path');

const src = path.join(
  __dirname,
  '..',
  'node_modules',
  'pdfjs-dist',
  'build',
  'pdf.worker.min.mjs'
);
const dest = path.join(__dirname, '..', 'public', 'pdf.worker.min.mjs');

try {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-pdfjs-worker] source not found: ${src} (skipping)`);
    process.exit(0);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  const size = fs.statSync(dest).size;
  console.log(`[copy-pdfjs-worker] copied to public/pdf.worker.min.mjs (${size} bytes)`);
} catch (err) {
  console.error('[copy-pdfjs-worker] failed:', err.message);
  // Non-fatal — PDF inspection will fail at runtime with a clear error if missing.
  process.exit(0);
}
