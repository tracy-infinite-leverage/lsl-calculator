export function Footer() {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          NSW LSL Calculator. Citations refer to the{' '}
          <span className="font-medium text-foreground">Long Service Leave Act 1955 (NSW)</span>.
        </p>
        <p>
          Not legal advice. Compute the legislated value; verify on the source statute for
          edge cases.
        </p>
      </div>
    </footer>
  );
}
