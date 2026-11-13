import { Button } from '../../ui';

/** Placeholder until the consented cloud scan exists (Fase 3, no-Nano path). */
export function ConsentPlaceholder({ onBack }: { readonly onBack: () => void }) {
  return (
    <section className="max-w-xl">
      <h1 id="screen-heading" tabIndex={-1} className="text-3xl font-bold tracking-tight">
        We can&apos;t check privately here
      </h1>
      <p className="mt-4 text-lg">
        On-device AI isn&apos;t available in this browser. Cloud scanning with your consent is
        coming next.
      </p>
      <p className="mt-2 text-muted">Nothing has been sent anywhere.</p>
      <div className="mt-6">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
      </div>
    </section>
  );
}
