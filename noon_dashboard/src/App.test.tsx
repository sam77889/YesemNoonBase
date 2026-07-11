// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import App from './App';
import * as deviceDetect from './hooks/useDeviceDetect';

// Mock device detection
vi.mock('./hooks/useDeviceDetect', () => ({
  useDeviceDetect: vi.fn()
}));

// Mock sub-components and hooks to avoid React Query and context errors during testing
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(),
}));

vi.mock('./hooks/useProducts', () => ({
  useProducts: () => ({ data: null }),
  useTasks: () => ({ data: [] }),
  usePriceHistory: () => ({ data: [], refetch: vi.fn() }),
}));

vi.mock('./hooks/useScrapeController', () => ({
  useScrapeController: () => ({
    triggerScrape: vi.fn(),
    handleAnalysisExecutionUpdate: vi.fn(),
    clearExecutionBlocks: vi.fn(),
    scraping: false,
    waitingForLog: false,
    executionBlocks: []
  })
}));

vi.mock('./hooks/useGlobalFilters', () => ({
  useGlobalFilters: () => ({
    listParams: {},
    overviewParams: {},
    filterText: '',
    setFilterText: vi.fn(),
    selectedCategory: '',
    setSelectedCategory: vi.fn(),
    categoryTabs: [],
    page: 1,
    pageSize: 50,
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn()
  })
}));

vi.mock('./pages/MobileApp', () => ({
  MobileApp: () => <div data-testid="mobile-app">Mobile App</div>
}));

vi.mock('./components/PriceTrendModal', () => ({
  PriceTrendModal: () => null
}));

describe('App Routing Dispatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should stay at / path on desktop', () => {
    vi.mocked(deviceDetect.useDeviceDetect).mockReturnValue({ isMobile: false } as any);
    
    render(<App />);
    
    // Advance timers for the 150ms debounce
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(window.location.pathname).toBe('/');
  });

  it('should redirect to /mobile on mobile', () => {
    vi.mocked(deviceDetect.useDeviceDetect).mockReturnValue({ isMobile: true } as any);
    
    render(<App />);
    
    // Advance timers for the 150ms debounce
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(window.location.pathname).toBe('/mobile');
  });
});
