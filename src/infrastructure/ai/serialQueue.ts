/**
 * Runs async tasks strictly one at a time, in the order they were enqueued.
 *
 * Why: the SDK opens a new Chrome Prompt API session for every on-device
 * `generateContent` and destroys the previous one (`createSession`, @firebase/ai
 * dist/esm/index.esm.js l.1160-1178), so overlapping on-device calls would tear down
 * each other's sessions. Every on-device runner shares ONE injected queue.
 */
export interface SerialQueue {
  /** Resolves or rejects with the task's own outcome once it has run. */
  enqueue<T>(task: () => Promise<T>): Promise<T>;
}

const ignore = (): void => undefined;

export function createSerialQueue(): SerialQueue {
  // Always-fulfilled tail: a rejected task never blocks or breaks the tasks after it.
  let tail: Promise<void> = Promise.resolve();
  return {
    enqueue<T>(task: () => Promise<T>): Promise<T> {
      const run = tail.then(task);
      tail = run.then(ignore, ignore);
      return run;
    },
  };
}
