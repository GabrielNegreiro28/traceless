import type { IncomingMessage, ServerResponse } from 'node:http';
import { MAX_BODY_BYTES, saveEvalResult } from './evalResultsStore.ts';

export const EVAL_RESULTS_ROUTE = '/__eval/results';

/** At most this many writes per window (the page saves once per evaluation). */
export const MAX_WRITES_PER_WINDOW = 20;
export const WINDOW_MS = 60_000;

type Next = () => void;

export interface HandlerOptions {
  readonly resultsDir: string;
  readonly now?: () => number;
}

/** Reads the body, stopping early once it exceeds the cap. Null means too large. */
async function readBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function reply(res: ServerResponse, status: number, body: object): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/** A same-origin page only: Vite's CORS middleware answers preflights for localhost origins. */
function isSameOrigin(req: IncomingMessage): boolean {
  if (req.headers['sec-fetch-site'] === 'same-origin') return true;
  const { origin, host } = req.headers;
  return origin !== undefined && host !== undefined && origin === `http://${host}`;
}

function isJsonRequest(req: IncomingMessage): boolean {
  return (req.headers['content-type'] ?? '').startsWith('application/json');
}

/** Sliding-window write counter; returns true when another write is allowed. */
function createRateCap(now: () => number): () => boolean {
  let writes: number[] = [];
  return () => {
    const current = now();
    writes = writes.filter((t) => current - t < WINDOW_MS);
    if (writes.length >= MAX_WRITES_PER_WINDOW) return false;
    writes.push(current);
    return true;
  };
}

async function handlePost(req: IncomingMessage, res: ServerResponse, dir: string): Promise<void> {
  const text = await readBody(req);
  if (text === null) return reply(res, 413, { error: 'Body too large.' });
  const outcome = await saveEvalResult(text, dir, new Date());
  reply(res, outcome.status, outcome.body);
}

/** Connect middleware for POST /__eval/results; other methods pass through. */
export function createEvalResultsHandler(options: HandlerOptions) {
  const allowWrite = createRateCap(options.now ?? Date.now);
  return (req: IncomingMessage, res: ServerResponse, next: Next): void => {
    if (req.method !== 'POST') return next();
    if (!isSameOrigin(req)) return reply(res, 403, { error: 'Cross-site request refused.' });
    if (!isJsonRequest(req)) return reply(res, 415, { error: 'Expected application/json.' });
    if (!allowWrite()) return reply(res, 429, { error: 'Too many writes; wait a minute.' });
    handlePost(req, res, options.resultsDir).catch(() => {
      if (!res.headersSent) reply(res, 500, { error: 'Unexpected error.' });
    });
  };
}
