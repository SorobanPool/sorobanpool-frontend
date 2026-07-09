import { describe, expect, it, vi } from 'vitest';
import { subscribePool, type EventSourceLike } from './pool-stream';

class FakeSource implements EventSourceLike {
  handlers = new Map<string, (e: { data: string }) => void>();
  closed = false;
  constructor(readonly url: string) {}
  addEventListener(type: string, cb: (e: { data: string }) => void) { this.handlers.set(type, cb); }
  close() { this.closed = true; }
  emit(type: string) { this.handlers.get(type)?.({ data: '{}' }); }
}

describe('subscribePool', () => {
  it('ignores the first frame, reacts to later ones, ignores pings, and closes on cleanup', () => {
    let src!: FakeSource;
    const onChange = vi.fn();
    const stop = subscribePool('42', onChange, (u) => (src = new FakeSource(u)));
    expect(src.url).toMatch(/\/v1\/pools\/42\/stream$/);
    src.emit('pool');
    expect(onChange).not.toHaveBeenCalled();
    src.emit('pool');
    src.emit('ping');
    src.emit('pool');
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
    expect(src.closed).toBe(true);
  });

  it('survives environments where EventSource cannot be created', () => {
    const stop = subscribePool('1', vi.fn(), () => { throw new Error('unsupported'); });
    expect(() => stop()).not.toThrow();
  });
});
