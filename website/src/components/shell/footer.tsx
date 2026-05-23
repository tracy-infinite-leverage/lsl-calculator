import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          NSW LSL Calculator. Citations refer to the{' '}
          <span className="font-medium text-foreground">Long Service Leave Act 1955 (NSW)</span>.
        </p>
        <nav aria-label="Footer" className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-foreground underline-offset-2 hover:underline">
            Privacy
          </Link>
          <span className="opacity-60">·</span>
          <p className="text-right sm:max-w-sm">
            Not legal advice. Compute the legislated value; verify on the source statute for
            edge cases.
          </p>
        </nav>
      </div>
    </footer>
  );
}
