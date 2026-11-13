/** Landing content (placeholder until the onboarding screen); rendered inside the AppShell. */
export function App() {
  return (
    <section className="mx-auto max-w-xl py-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        Report wrongdoing without leaving a trace.
      </h1>
      <p className="mt-6 text-lg text-pretty text-muted">
        Traceless finds the details in your report that could reveal who you are, right on your
        device, before anything is sent.
      </p>
    </section>
  );
}
