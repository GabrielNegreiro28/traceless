function toPercent(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(Math.min(1, Math.max(0, value)) * 100);
}

/** Determinate progress (value 0..1) or, with no value, an indeterminate bar. */
export function ProgressBar(props: { readonly label: string; readonly value?: number }) {
  const percent = toPercent(props.value);
  return (
    <div
      role="progressbar"
      aria-label={props.label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2 w-full overflow-hidden rounded-full bg-border"
    >
      <div
        className={
          percent === undefined
            ? 'h-full w-1/3 rounded-full bg-accent motion-safe:animate-pulse'
            : 'h-full rounded-full bg-accent transition-[width]'
        }
        style={percent === undefined ? undefined : { width: `${String(percent)}%` }}
      />
    </div>
  );
}
