/** Stand-in for a screen that is built in a later task. */
export function PlaceholderPage(props: { readonly title: string; readonly description: string }) {
  return (
    <section className="max-w-xl">
      <h1 className="text-3xl font-bold tracking-tight">{props.title}</h1>
      <p className="mt-4 text-lg text-muted">{props.description}</p>
    </section>
  );
}
