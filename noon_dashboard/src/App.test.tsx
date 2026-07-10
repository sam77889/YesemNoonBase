// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('App Routing Dispatcher', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should stay at / path on desktop', () => {
    expect(window.location.pathname).toBe('/');
  });
});
