/**
 * Ambient declaration for the `pdfjs-dist/build/pdf.mjs` subpath.
 *
 * The published `pdfjs-dist` package only ships types for the bare entry
 * (`types/src/pdf.d.ts` via the package `types` field). The subpath we
 * import client-side has no .d.ts file, so we re-export the bare-entry
 * types here.
 *
 * Why we use the subpath at all: Turbopack rewrites the bare specifier
 * to `legacy/build/pdf.mjs`, which expects DOMMatrix to be polyfilled
 * and crashes modern Chrome with "DOMMatrix is not defined" (issue #5).
 * Forcing the main-build subpath fixes that.
 */
declare module 'pdfjs-dist/build/pdf.mjs' {
  export * from 'pdfjs-dist';
}
