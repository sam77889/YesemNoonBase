import { useState, lazy, Suspense, Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { LayoutDashboard, Terminal, Activity, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from '../components/ThemeToggle';
import { PageSpinner } from '../components/PageSpinner';

// 懒加载移动端专属页面
const MobileOverviewPage = lazy(() => import('./MobileOverviewPage').then(m => ({ default: m.MobileOverviewPage })));
const MobileScraperPage = lazy(() => import('./MobileScraperPage').then(m => ({ default: m.MobileScraperPage })));
const MobileSystemLogsPage = lazy(() => import('./MobileSystemLogsPage').then(m => ({ default: m.MobileSystemLogsPage })));
const MobileCategoryAnalysisPage = lazy(() => import('./MobileCategoryAnalysisPage').then(m => ({ default: m.MobileCategoryAnalysisPage })));

type TabId = 'overview' | 'scraper' | 'logs' | 'category';

const MOBILE_NAV_ITEMS = [
  { id: 'overview' as TabId, label: '总览', icon: LayoutDashboard },
  { id: 'category' as TabId, label: '品类', icon: Layers },
  { id: 'scraper' as TabId, label: '搜索', icon: Terminal },
  { id: 'logs' as TabId, label: '日志', icon: Activity },
];

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MobileApp ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#ff4d4f' }}>
          Failed to load page content.
        </div>
      );
    }
    return this.props.children;
  }
}

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <div className="mobile-app-container">
      {/* 动态背景 */}
      <div className="app-background" aria-hidden="true" />
      
      {/* 头部 Topbar */}
      <header className="mobile-topbar">
        <div className="mobile-brand">一森数字科技</div>
        <div className="mobile-header-actions">
          <span className="mobile-status-dot" />
          <span className="mobile-status-text">在线</span>
          <ThemeToggle />
        </div>
      </header>

      {/* 主滚动区 */}
      <main className="mobile-main-content">
        <ErrorBoundary>
          <Suspense fallback={<PageSpinner />}>
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.15 }}>
                  <MobileOverviewPage />
                </motion.div>
              )}
              {activeTab === 'scraper' && (
                <motion.div key="scraper" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.15 }}>
                  <MobileScraperPage />
                </motion.div>
              )}
              {activeTab === 'logs' && (
                <motion.div key="logs" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.15 }}>
                  <MobileSystemLogsPage />
                </motion.div>
              )}
              {activeTab === 'category' && (
                <motion.div key="category" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.15 }}>
                  <MobileCategoryAnalysisPage />
                </motion.div>
              )}
            </AnimatePresence>
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* 底部导航栏 TabBar */}
      <nav className="mobile-bottom-nav">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button key={item.id} type="button" className={`mobile-nav-btn ${isActive ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
              <div className="mobile-nav-btn-icon">
                <Icon size={22} />
                {isActive && (
                  <motion.div layoutId="mobileActiveIndicator" className="mobile-active-indicator" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                )}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
