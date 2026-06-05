// No directive → this is a server module by Next.js convention.
// The import below pulls a 'use client' module into the server bundle
// and MUST be flagged by lsl/no-cross-rsc-boundary.
// This is the PR #108 (E6.3 Task 3.3) failure shape.
import { clientHelper } from './client-module';

export function badServerFn(): string {
  return clientHelper();
}
