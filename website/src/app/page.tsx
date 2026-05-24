import Link from 'next/link';
import { ArrowRight, FileText, Users } from 'lucide-react';
import { Header } from '@/components/shell/header';
import { Footer } from '@/components/shell/footer';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:pt-24">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-wider text-primary">
              Long Service Leave
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Australian LSL calculator.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Calculate long service leave for employees with every numeric output traceable to
              a section of the relevant State Long Service Leave Act. Built on the legislated
              requirements for each State, not the system shortcut your payroll software runs.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="group hover:border-primary transition-colors">
              <CardHeader>
                <FileText className="h-7 w-7 text-primary mb-2" aria-hidden />
                <CardTitle>Single employee</CardTitle>
                <CardDescription>
                  One employee, one event. Taking leave, termination, or a LSL liability
                  snapshot. Enter wage history by CSV (PDF extraction coming soon).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/calculator/single">
                    Calculate for one employee
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group">
              <CardHeader>
                <Users className="h-7 w-7 text-primary mb-2" aria-hidden />
                <CardTitle>Bulk mode</CardTitle>
                <CardDescription>
                  Multiple employees in one upload. Audit & liability reporting. CSV in, results out.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/calculator/bulk">
                    Calculate for many
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="mt-12 text-sm text-muted-foreground max-w-2xl">
            All calculations cite the relevant LSA section, every output is defensible against
            a long service leave audit.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
