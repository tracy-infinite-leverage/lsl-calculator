/**
 * Local ESLint plugin for project-specific rules.
 *
 * Rules:
 *   - `no-cross-rsc-boundary` — flags imports that cross the React Server
 *     Components server/client boundary. See `./no-cross-rsc-boundary.js`.
 *
 * Registered in `eslint.config.mjs` under the `lsl/` namespace.
 */

const noCrossRscBoundary = require('./no-cross-rsc-boundary.js');

module.exports = {
  rules: {
    'no-cross-rsc-boundary': noCrossRscBoundary,
  },
};
