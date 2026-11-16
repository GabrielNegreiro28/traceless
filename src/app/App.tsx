import { Link } from 'react-router';

/** Never claims unconditional on-device processing (design plan §2): it depends on the browser. */
export const PRIVACY_PROMISE =
  'On supported Chrome, your text is checked on your device. Elsewhere, nothing is sent unless you explicitly agree.';

export const LOGLINE = 'Report wrongdoing without your own words giving you away.';

const THESIS = 'Anonymity fails by content, not by channel.';

const THESIS_DETAIL =
  'A report sent through a secure channel can still point straight at you: your unique role, your shift, the place, the dates, the way you write. Traceless finds those details before you send anything.';

const STEPS: readonly { readonly title: string; readonly body: string }[] = [
  { title: 'Write', body: 'Describe what happened, in your own words.' },
  {
    title: 'Check on your device',
    body: 'Traceless flags details that could identify you and suggests safer wording.',
  },
  {
    title: 'Send only approved text',
    body: 'You review exactly what leaves your device. Nothing else is sent.',
  },
];

const LINK_BASE =
  'inline-flex min-h-11 items-center justify-center rounded-md border px-4 py-2 text-base font-semibold';

/** Landing content; rendered inside the AppShell. */
export function App() {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">{LOGLINE}</h1>
        <p className="mt-6 text-xl font-semibold text-balance">{THESIS}</p>
        <p className="mt-3 text-pretty text-muted">{THESIS_DETAIL}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/report?sample=1"
            className={`${LINK_BASE} border-transparent bg-accent text-accent-contrast hover:opacity-90`}
          >
            Try a sample report
          </Link>
          <Link to="/report" className={`${LINK_BASE} border-border bg-surface hover:bg-bg`}>
            Write your own report
          </Link>
        </div>
      </section>
      <section aria-labelledby="how-heading" className="mt-12">
        <h2 id="how-heading" className="text-2xl font-bold tracking-tight">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-md border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-muted">Step {index + 1}</p>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="ai-heading" className="mt-12">
        <h2 id="ai-heading" className="text-2xl font-bold tracking-tight">
          Where the AI runs
        </h2>
        <p className="mt-3 text-pretty text-muted">
          {PRIVACY_PROMISE} The on-device check uses Chrome&apos;s built-in Gemini Nano. If it is
          not available, you can choose a cloud check after an explicit consent, or continue with
          basic pattern checks that never leave your device.
        </p>
      </section>
      <p className="mt-10 text-center text-sm text-muted">
        Already sent a report?{' '}
        <Link to="/case" className="underline">
          Follow up on your case
        </Link>
      </p>
    </div>
  );
}
