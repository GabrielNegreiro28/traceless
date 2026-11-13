import { describe, expect, it, vi } from 'vitest';
import { createLogger, logger, type LogSink } from './logger';

function fakeSink(): LogSink {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('createLogger', () => {
  it('prefixes the message and forwards metadata', () => {
    const sink = fakeSink();
    createLogger({ sink, minLevel: 'debug', enabled: true }).info('scan finished', { findings: 3 });

    expect(sink.info).toHaveBeenCalledWith('[traceless] scan finished', { findings: 3 });
  });

  it('omits the metadata argument when none is given', () => {
    const sink = fakeSink();
    createLogger({ sink, minLevel: 'debug', enabled: true }).error('failed');

    expect(sink.error).toHaveBeenCalledWith('[traceless] failed');
  });

  it('drops messages below the minimum level', () => {
    const sink = fakeSink();
    const log = createLogger({ sink, minLevel: 'warn', enabled: true });
    log.debug('a');
    log.info('b');
    log.warn('c');

    expect(sink.debug).not.toHaveBeenCalled();
    expect(sink.info).not.toHaveBeenCalled();
    expect(sink.warn).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when disabled', () => {
    const sink = fakeSink();
    createLogger({ sink, minLevel: 'debug', enabled: false }).error('x');

    expect(sink.error).not.toHaveBeenCalled();
  });
});

describe('logger (default instance)', () => {
  it('is silent in test mode', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logger.error('should not appear');

    expect(spy).not.toHaveBeenCalled();
  });
});
