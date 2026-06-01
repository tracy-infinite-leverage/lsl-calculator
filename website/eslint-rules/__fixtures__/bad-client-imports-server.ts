'use client';

// This client module imports from a 'use server' module without an
// explicit eslint-disable comment. The rule should flag it so the
// developer confirms only async function actions are imported (not
// consts/types). This is the PR #68 (E5.1 Phase 6) failure shape.
import { serverAction } from './server-module';

export async function badClientFn(): Promise<string> {
  return serverAction();
}
