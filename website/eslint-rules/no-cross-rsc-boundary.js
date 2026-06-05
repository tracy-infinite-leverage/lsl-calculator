/**
 * no-cross-rsc-boundary
 *
 * Flags imports that cross the React Server Components (RSC) server/client
 * boundary in either direction:
 *
 *   - A server file (no `'use client'` directive) importing from a file that
 *     declares `'use client'` at the top. This pulls client-only code into
 *     the server bundle and was the root cause of PR #108 (E6.3 Task 3.3)
 *     where `parseTenantClaimsCookie()` was imported from a `'use client'`
 *     module into `tenant-context-server.tsx`.
 *
 *   - A client file (declares `'use client'`) importing from a file that
 *     declares `'use server'` at the top. While Server Actions are legitimate
 *     and SHOULD be importable this way, the boundary is invisible at the
 *     call site. Forcing an `eslint-disable-next-line` on every crossing
 *     surfaces the boundary so non-function exports (PR #68: E5.1 Phase 6
 *     where `INITIAL_STATE` consts were exported from a `'use server'` file)
 *     are caught at review time.
 *
 * In both incidents the failure surfaced via Playwright at runtime instead
 * of `tsc` at type-check time. This rule moves detection to lint time —
 * before code ever runs.
 *
 * Scope (intentionally simple — 80% catch):
 *   - Detects direct static `import` statements only.
 *   - Resolves relative imports (`./`, `../`) and `@/`-aliased imports.
 *   - Reads the first ~5 lines of each resolved file to detect directives.
 *   - Skips re-exports (`export * from`), dynamic imports (`import()`),
 *     and conditional imports. These are surfaced as future-work findings
 *     in the HANDOFF doc.
 *
 * @type {import('eslint').Rule.RuleModule}
 */

const fs = require('node:fs');
const path = require('node:path');

const DIRECTIVE_SCAN_LIMIT = 2048; // bytes — directives must appear in the first ~5 lines

/**
 * Detect the RSC directive at the top of a file.
 * Returns 'client', 'server', or null.
 */
function detectDirective(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(DIRECTIVE_SCAN_LIMIT);
    const bytesRead = fs.readSync(fd, buf, 0, DIRECTIVE_SCAN_LIMIT, 0);
    fs.closeSync(fd);
    const head = buf.toString('utf8', 0, bytesRead);

    // Strip leading whitespace/comments to find the first non-trivial statement.
    // We allow shebangs, block comments, and line comments before the directive.
    let i = 0;
    while (i < head.length) {
      // Skip whitespace
      while (i < head.length && /\s/.test(head[i])) i++;
      if (i >= head.length) break;

      // Skip line comments
      if (head.startsWith('//', i)) {
        const nl = head.indexOf('\n', i);
        if (nl === -1) return null;
        i = nl + 1;
        continue;
      }

      // Skip block comments
      if (head.startsWith('/*', i)) {
        const end = head.indexOf('*/', i + 2);
        if (end === -1) return null;
        i = end + 2;
        continue;
      }

      // First real token — must be the directive string literal.
      const rest = head.slice(i);
      const match = rest.match(/^(['"])(use client|use server)\1\s*;?/);
      if (!match) return null;
      return match[2] === 'use client' ? 'client' : 'server';
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve an import specifier to an absolute file path.
 * Returns null if the specifier is a bare module (e.g. 'react') or cannot be resolved.
 */
function resolveImportPath(specifier, currentFile, aliasConfig) {
  let basePath;

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    basePath = path.resolve(path.dirname(currentFile), specifier);
  } else if (aliasConfig && specifier.startsWith(aliasConfig.prefix)) {
    const sub = specifier.slice(aliasConfig.prefix.length);
    basePath = path.resolve(aliasConfig.absoluteRoot, sub);
  } else {
    // Bare module — out of scope.
    return null;
  }

  // Try common extensions and index files.
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.jsx'),
  ];

  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // Try next.
    }
  }
  return null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow imports that cross the React Server Components server/client boundary',
      recommended: false,
    },
    schema: [
      {
        type: 'object',
        properties: {
          alias: {
            type: 'object',
            properties: {
              prefix: { type: 'string' },
              absoluteRoot: { type: 'string' },
            },
            required: ['prefix', 'absoluteRoot'],
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      serverImportsClient:
        "Server module imports from a 'use client' module ({{importedFile}}). " +
        'This pulls client-only code into the server bundle. Move the shared ' +
        'helper to a directive-free module, or mark the consumer as a Client ' +
        "Component. See PR #108 for the prod incident this rule prevents.",
      clientImportsServer:
        "Client module imports from a 'use server' module ({{importedFile}}). " +
        'Server Action imports are legitimate but the boundary should be ' +
        'explicit. Confirm only async function actions are imported (not ' +
        'consts/types), then add `// eslint-disable-next-line ' +
        'lsl/no-cross-rsc-boundary` on the import line. See PR #68 for the ' +
        'prod incident this rule prevents.',
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const aliasConfig = options.alias
      ? {
          prefix: options.alias.prefix,
          absoluteRoot: path.isAbsolute(options.alias.absoluteRoot)
            ? options.alias.absoluteRoot
            : path.resolve(process.cwd(), options.alias.absoluteRoot),
        }
      : null;

    const currentFile = context.filename || context.getFilename();
    const currentDirective = detectDirective(currentFile);
    // Current file is a "server module" if it has no directive OR explicit 'use server'.
    // (We only care about the import direction relative to the boundary.)
    const isCurrentClient = currentDirective === 'client';

    return {
      ImportDeclaration(node) {
        const specifier = node.source.value;
        if (typeof specifier !== 'string') return;

        const resolved = resolveImportPath(specifier, currentFile, aliasConfig);
        if (!resolved) return;

        const targetDirective = detectDirective(resolved);
        if (!targetDirective) return;

        const importedFile = path.relative(process.cwd(), resolved);

        if (!isCurrentClient && targetDirective === 'client') {
          // Server (or directive-free) → Client.
          context.report({
            node: node.source,
            messageId: 'serverImportsClient',
            data: { importedFile },
          });
          return;
        }

        if (isCurrentClient && targetDirective === 'server') {
          // Client → Server.
          context.report({
            node: node.source,
            messageId: 'clientImportsServer',
            data: { importedFile },
          });
        }
      },
    };
  },
};
