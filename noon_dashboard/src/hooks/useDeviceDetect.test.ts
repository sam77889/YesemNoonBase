// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDeviceDetect } from './useDeviceDetect';

describe('useDeviceDetect', () => {
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      configurable: true,
    });
  });

  it('should return isMobile true when screen width is under 768px', () => {
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    const { result } = renderHook(() => useDeviceDetect());
    expect(result.current.isMobile).toBe(true);
  });

  it('should return isMobile true when userAgent matches mobile OS', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
      configurable: true,
    });
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    const { result } = renderHook(() => useDeviceDetect());
    expect(result.current.isMobile).toBe(true);
  });

  it('should return isMobile false on desktop wide screen', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
    const { result } = renderHook(() => useDeviceDetect());
    expect(result.current.isMobile).toBe(false);
  });
});
