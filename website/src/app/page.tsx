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
              NSW Long Service Leave
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              The defensible LSL calculator.
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Compute long-service-leave for any NSW employee with every numeric output traceable to
              a section of the <span className="font-medium text-foreground">Long Service Leave Act 1955</span>.
              Built on the legislated <em>greater of (current rate, 12-month average, 5-year average)</em>
              {' '}test — not the system shortcut your payroll software runs.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="group hover:border-primary transition-colors">
              <CardHeader>
                <FileText className="h-7 w-7 text-primary mb-2" aria-hidden />
                <CardTitle>Single mode</CardTitle>
                <CardDescription>
                  One employee, one event — taking leave, termination, or an as-at snapshot.
                  Enter wage history by CSV (PDF extraction coming in Phase 3).
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

            <Card className="group opacity-60">
              <CardHeader>
                <Users className="h-7 w-7 text-muted-foreground mb-2" aria-hidden />
                <CardTitle>Bulk mode</CardTitle>
                <CardDescription>
                  Many employees in one upload — audit & liability reporting. Coming in Phase 4.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" disabled className="w-full sm:w-auto">
                  Calculate for many
                </Button>
              </CardContent>
            </Card>
          </div>

          <p className="mt-12 text-sm text-muted-foreground max-w-2xl">
            v1 supports NSW only. Other states (VIC, QLD, WA, SA, TAS, ACT, NT) follow in E2.
            All calculations cite the relevant LSA section — every output is defensible
            against an auditor.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
