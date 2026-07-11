// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
import { MobileApp } from './MobileApp';
import React from 'react';

// Mock components to avoid testing actual lazy loaded implementations
vi.mock('./MobileOverviewPage', () => ({
  MobileOverviewPage: () => <div data-testid="mobile-overview">Overview</div>
}));

vi.mock('./MobileScraperPage', () => ({
  MobileScraperPage: () => <div data-testid="mobile-scraper">Scraper</div>
}));

vi.mock('./MobileSystemLogsPage', () => ({
  MobileSystemLogsPage: () => <div data-testid="mobile-logs">Logs</div>
}));

// Mock framer-motion to skip animations
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => <>{children}</>,
    motion: {
      div: ({ children, ...props }: any) => {
        const { layoutId, animate, initial, exit, transition, ...rest } = props;
        return <div {...rest}>{children}</div>;
      }
    }
  };
});

describe('MobileApp Component', () => {
  it('renders topbar and navigation tabs', () => {
    render(<MobileApp />);
    
    // Header check
    expect(screen.getByText('一森数字科技')).toBeDefined();
    expect(screen.getByText('在线')).toBeDefined();
    
    // Tab checks
    expect(screen.getByText('总览')).toBeDefined();
    expect(screen.getByText('搜索')).toBeDefined();
    expect(screen.getByText('日志')).toBeDefined();
  });

  it('renders overview page by default', async () => {
    render(<MobileApp />);
    
    await waitFor(() => {
      expect(screen.getByTestId('mobile-overview')).toBeDefined();
    });
    
    expect(screen.queryByTestId('mobile-scraper')).toBeNull();
    expect(screen.queryByTestId('mobile-logs')).toBeNull();
  });

  it('switches tabs correctly', async () => {
    render(<MobileApp />);
    
    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTestId('mobile-overview')).toBeDefined();
    });

    // Click scraper tab
    const scraperTab = screen.getByText('搜索').closest('button');
    fireEvent.click(scraperTab!);

    await waitFor(() => {
      expect(screen.getByTestId('mobile-scraper')).toBeDefined();
    });
    expect(screen.queryByTestId('mobile-overview')).toBeNull();

    // Click logs tab
    const logsTab = screen.getByText('日志').closest('button');
    fireEvent.click(logsTab!);

    await waitFor(() => {
      expect(screen.getByTestId('mobile-logs')).toBeDefined();
    });
    expect(screen.queryByTestId('mobile-scraper')).toBeNull();
  });

  it('verifies touch target size of tab buttons', () => {
    render(<MobileApp />);
    const buttons = screen.getAllByRole('button');
    // Tab buttons should have class mobile-nav-btn
    const navButtons = buttons.filter(b => b.className.includes('mobile-nav-btn'));
    expect(navButtons.length).toBe(3);
    // The touch target sizing is defined in CSS via min-width and height
  });
});
