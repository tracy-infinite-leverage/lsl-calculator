'use client';

// Fixture: a 'use client' module to be imported by other fixtures.
export const CLIENT_CONST = 'client-only-value';

export function clientHelper(): string {
  return CLIENT_CONST;
}
