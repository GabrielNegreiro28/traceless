/** Never claims unconditional on-device processing (design plan §2): it depends on the browser. */
export const PRIVACY_PROMISE =
  'On supported Chrome, your text is checked on your device. Elsewhere, nothing is sent unless you explicitly agree.';

/** Landing content (placeholder until the onboarding screen); rendered inside the AppShell. */
export function App() {
  return (
    <section className="mx-auto max-w-xl py-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        Report wrongdoing without leaving a trace.
      </h1>
      <p className="mt-6 text-lg text-pretty text-muted">
        Traceless finds the details in your report that could reveal who you are, before anything is
        sent.
      </p>
      <p className="mt-4 text-pretty text-muted">{PRIVACY_PROMISE}</p>
    </section>
  );
}
