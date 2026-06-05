import { SingleModeForm } from './_components/single-mode-form';

export default function SingleModePage() {
  return (
    <div className="space-y-6">
      {/* Page heading + intro copy are screen-only — `print:hidden` so
       * Cmd+P emits a result-only deliverable (E6.5 Task 5.6). */}
      <div className="print:hidden">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Single-employee calculator
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Enter the employee&apos;s details, the wage history and any continuous-service events.
          The calculator returns a citation-backed entitlement value for the trigger you select.
        </p>
      </div>
      <SingleModeForm />
    </div>
  );
}
