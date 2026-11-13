import type { IncomingMessage, ServerResponse } from 'node:http';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  createEvalResultsHandler,
  MAX_WRITES_PER_WINDOW,
  WINDOW_MS,
} from './evalResultsHandler.ts';
import { MAX_BODY_BYTES } from './evalResultsStore.ts';
import { evalResultsPlugin } from './vite-plugin-eval-results.ts';

const SAME_ORIGIN = { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' };
const BODY = JSON.stringify({ promptVersion: 'p1', strategy: 'single', split: 'dev' });

function fakeRequest(
  headers: Record<string, string>,
  chunks: string[] = [BODY],
  method = 'POST',
): IncomingMessage {
  return Object.assign(Readable.from(chunks.map((c) => Buffer.from(c))), {
    method,
    headers,
  }) as unknown as IncomingMessage;
}

interface Captured {
  readonly res: ServerResponse;
  readonly done: Promise<{ status: number; body: string }>;
}

function fakeResponse(): Captured {
  let resolve: (v: { status: number; body: string }) => void = () => undefined;
  const done = new Promise<{ status: number; body: string }>((r) => (resolve = r));
  const res = {
    statusCode: 0 as number,
    headersSent: false,
    setHeader: () => undefined,
    end(this: { statusCode: number }, body: string) {
      resolve({ status: this.statusCode, body });
    },
  } as unknown as ServerResponse;
  return { res, done };
}

async function call(
  handler: ReturnType<typeof createEvalResultsHandler>,
  req: IncomingMessage,
): Promise<{ status: number; body: string; passed: boolean }> {
  const { res, done } = fakeResponse();
  let passed = false;
  handler(req, res, () => {
    passed = true;
  });
  if (passed) return { status: 0, body: '', passed };
  return { ...(await done), passed };
}

async function makeHandler(now?: () => number) {
  const resultsDir = await mkdtemp(join(tmpdir(), 'traceless-eval-handler-'));
  const options = now === undefined ? { resultsDir } : { resultsDir, now };
  return { resultsDir, handler: createEvalResultsHandler(options) };
}

describe('eval results middleware', () => {
  it('saves a same-origin JSON post', async () => {
    const { handler, resultsDir } = await makeHandler();
    const result = await call(handler, fakeRequest(SAME_ORIGIN));
    expect(result.status).toBe(201);
    expect(await readdir(resultsDir)).toHaveLength(1);
  });

  it('accepts a matching Origin header', async () => {
    const { handler } = await makeHandler();
    const headers = {
      'content-type': 'application/json',
      origin: 'http://localhost:5173',
      host: 'localhost:5173',
    };
    expect((await call(handler, fakeRequest(headers))).status).toBe(201);
  });

  it('refuses cross-site requests with 403', async () => {
    const { handler } = await makeHandler();
    const headers = { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' };
    expect((await call(handler, fakeRequest(headers))).status).toBe(403);
    const foreign = { 'content-type': 'application/json', origin: 'http://evil.test', host: 'a' };
    expect((await call(handler, fakeRequest(foreign))).status).toBe(403);
  });

  it('refuses a non-JSON content type with 415', async () => {
    const { handler } = await makeHandler();
    const headers = { 'sec-fetch-site': 'same-origin', 'content-type': 'text/plain' };
    expect((await call(handler, fakeRequest(headers))).status).toBe(415);
  });

  it('stops reading a streamed oversize body with 413', async () => {
    const { handler, resultsDir } = await makeHandler();
    const chunk = 'x'.repeat(1024 * 1024);
    const req = fakeRequest(SAME_ORIGIN, [chunk, chunk, chunk]);
    expect(chunk.length * 3).toBeGreaterThan(MAX_BODY_BYTES);
    expect((await call(handler, req)).status).toBe(413);
    expect(await readdir(resultsDir)).toHaveLength(0);
  });

  it('lets GET requests pass through to the next middleware', async () => {
    const { handler } = await makeHandler();
    expect((await call(handler, fakeRequest({}, [], 'GET'))).passed).toBe(true);
  });

  it('caps writes per minute with 429', async () => {
    let clock = 0;
    const { handler } = await makeHandler(() => clock);
    for (let i = 0; i < MAX_WRITES_PER_WINDOW; i++) {
      await call(handler, fakeRequest(SAME_ORIGIN));
    }
    expect((await call(handler, fakeRequest(SAME_ORIGIN))).status).toBe(429);
    clock += WINDOW_MS + 1;
    // Past the window a write is allowed again (409 only means the same-millisecond name exists).
    expect((await call(handler, fakeRequest(SAME_ORIGIN))).status).not.toBe(429);
  });

  it('answers 500 when reading the body fails', async () => {
    const { handler } = await makeHandler();
    const req = fakeRequest(SAME_ORIGIN);
    vi.spyOn(req, Symbol.asyncIterator).mockImplementation(() => {
      throw new Error('stream broke');
    });
    expect((await call(handler, req)).status).toBe(500);
  });
});

describe('evalResultsPlugin', () => {
  it('only applies to the dev server', () => {
    expect(evalResultsPlugin().apply).toBe('serve');
  });
});
