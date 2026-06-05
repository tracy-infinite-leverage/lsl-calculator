'use server';

// Fixture: a 'use server' module to be imported by other fixtures.
// Real server-actions files export async functions only. This fixture
// emulates that surface.
export async function serverAction(): Promise<string> {
  return 'server-only-value';
}
