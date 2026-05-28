import Link from 'next/link';
import { Scale } from '@/components/brand/Icon';

export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <Scale className="h-5 w-5 text-primary" aria-hidden />
          <span>LSL Calculator</span>
        </Link>
        <nav className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/calculator/single" className="hover:text-foreground transition-colors">
            Single
          </Link>
          <Link href="/calculator/bulk" className="hover:text-foreground transition-colors">
            Bulk
          </Link>
        </nav>
      </div>
    </header>
  );
}
