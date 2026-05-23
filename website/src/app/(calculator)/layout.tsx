import { Header } from '@/components/shell/header';
import { Footer } from '@/components/shell/footer';

export default function CalculatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
      <Footer />
    </>
  );
}
