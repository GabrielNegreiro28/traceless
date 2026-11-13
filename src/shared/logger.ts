/**
 * Project logger. The only module allowed to touch `console` (see ESLint `no-console`).
 *
 * PRIVACY RULE: never pass raw report text (or anything derived from it, such as
 * model quotes or suggestions) as the message or in metadata. Log event names,
 * counts, durations, error kinds and inference sources only.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Structured metadata: flat primitives only, so whole objects are never dumped. */
export type LogMetadata = Readonly<Record<string, string | number | boolean | null>>;

export type LogSink = Pick<Console, LogLevel>;

export type Logger = {
  readonly [L in LogLevel]: (message: string, metadata?: LogMetadata) => void;
};

export type LoggerOptions = {
  readonly sink: LogSink;
  readonly minLevel: LogLevel;
  readonly enabled: boolean;
};

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = { debug: 0, info: 1, warn: 2, error: 3 };

export function createLogger({ sink, minLevel, enabled }: LoggerOptions): Logger {
  const write =
    (level: LogLevel) =>
    (message: string, metadata?: LogMetadata): void => {
      if (!enabled || LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
      const line = `[traceless] ${message}`;
      if (metadata === undefined) sink[level](line);
      else sink[level](line, metadata);
    };
  return { debug: write('debug'), info: write('info'), warn: write('warn'), error: write('error') };
}

/** App-wide logger: silent under Vitest, verbose in dev, info+ in production builds. */
export const logger: Logger = createLogger({
  sink: console,
  minLevel: import.meta.env.DEV ? 'debug' : 'info',
  enabled: import.meta.env.MODE !== 'test',
});
