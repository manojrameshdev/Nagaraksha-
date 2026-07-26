import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('@/lib/db', () => ({
  db: {
    outboxEvent: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    dispatchAttempt: {
      create: vi.fn(),
      update: vi.fn(),
    },
    incident: {
      update: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
    hospital: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

const { getBus } = await import('../eventbus');

describe('eventbus', () => {
  it('getBus returns a singleton', () => {
    const bus1 = getBus();
    const bus2 = getBus();
    expect(bus1).toBe(bus2);
  });

  it('returns an EventEmitter instance', () => {
    const bus = getBus();
    expect(bus).toBeInstanceOf(EventEmitter);
  });

  it('emits and receives a custom event', () => {
    const bus = getBus();
    const handler = vi.fn();
    bus.on('IncidentCreated', handler);
    bus.emit('IncidentCreated', 'inc-1', { lat: 12.97, lng: 77.59 });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith('inc-1', { lat: 12.97, lng: 77.59 });
  });
});
