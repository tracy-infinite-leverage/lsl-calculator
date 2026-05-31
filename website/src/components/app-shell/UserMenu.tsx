/**
 * UserMenu — client-side dropdown that hangs off the TopNav avatar.
 *
 * E6.3 Task 3.1. Renders the user-menu trigger (avatar + chevron) and a
 * Radix `DropdownMenu` panel with Profile + Sign-out entries. Driven entirely
 * by Radix focus / keyboard semantics — see `components/ui/dropdown-menu.tsx`
 * for the affordance contract.
 *
 * Sign-out runs through the existing E5.1 `/app/logout` POST route (see
 * `src/app/app/logout/route.ts`). We render a tiny `<form method="post"
 * action="/app/logout">` and let the "Sign out" menu item submit it via a
 * ref. This keeps the menu CSRF-safe — Radix `DropdownMenuItem` is a
 * `<div role="menuitem">`, not a button that can be hijacked client-side, and
 * the POST is the canonical logout path per AC-AUTH-7.
 *
 * Profile / Account: links to `/app/account`. That route is in the E5.1
 * `UNVERIFIED_ALLOW_LIST` (proxy.ts) and exists today as a placeholder; the
 * full account screen lands in a later E5.x slice.
 *
 * Server vs client split: this is the only piece of the TopNav that needs
 * client interactivity — the wordmark + bell are pure presentation. Keeping
 * the boundary tight here means the rest of the shell can stay server-
 * rendered.
 */

'use client';

import { useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LogOut, User } from '@/components/brand/Icon';
import { cn } from '@/lib/utils';

export interface UserMenuProps {
  /**
   * The signed-in user's email. Used as the visible label inside the
   * dropdown (single-line, truncated if it overflows the panel width).
   */
  email: string;
  /**
   * Optional display name. Empty string falls back to the local-part of the
   * email — keeps the avatar initials sensible even before profile-name
   * collection ships.
   */
  displayName?: string;
}

/**
 * Render initials for the avatar. Two-letter rule:
 *
 *   - "Tracy Angwin" → "TA"
 *   - "tracy"        → "T"
 *   - "tracy@…"      → "T"
 *   - empty          → "?"
 *
 * Kept inline (not a util-export) — only one consumer today, and the rules
 * are domain-specific (initials of a `displayName ?? email-local-part`).
 */
function initialsFor(displayName: string, email: string): string {
  const source = (displayName.trim() || email.split('@')[0] || '').trim();
  if (source.length === 0) return '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function UserMenu({ email, displayName = '' }: UserMenuProps) {
  // Hidden form is the actual POST target — Radix menu items are non-form
  // elements, so submitting via `formRef.current?.requestSubmit()` is the
  // cleanest bridge that still goes through the browser's normal form-post
  // (cookies, CSRF tokens via session, etc.) rather than a hand-rolled fetch.
  const logoutFormRef = useRef<HTMLFormElement>(null);

  const initials = initialsFor(displayName, email);
  const visibleLabel = (displayName.trim() || email).trim();

  return (
    <>
      {/* The logout form sits in the DOM next to the menu so the ref is
        * stable across renders. `display: contents` keeps it from
        * affecting layout. */}
      <form
        ref={logoutFormRef}
        action="/app/logout"
        method="post"
        style={{ display: 'contents' }}
        aria-hidden="true"
      />

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open user menu"
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm',
            'hover:bg-brand-light-blue/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2',
            'transition-colors',
          )}
        >
          {/* Initials avatar — navy circle, white text. Sized to the same
            * 32px the bell + wordmark sit on, so the right-rail height is
            * stable. */}
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-brand-white"
          >
            {initials}
          </span>
          <span className="hidden max-w-[10rem] truncate text-brand-charcoal sm:inline">
            {visibleLabel}
          </span>
          <ChevronDown
            className="h-4 w-4 text-brand-charcoal"
            aria-hidden="true"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          {/* Label: full email (truncated). Section header so screen readers
            * announce the menu owner before the actions. */}
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <a href="/app/account" className="flex items-center gap-2">
              <User className="h-4 w-4" aria-hidden="true" />
              <span>Profile</span>
            </a>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Sign-out triggers the hidden form. `onSelect` fires before the
            * menu closes, so the POST is in flight by the time the user
            * sees the dropdown collapse. */}
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              logoutFormRef.current?.requestSubmit();
            }}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
