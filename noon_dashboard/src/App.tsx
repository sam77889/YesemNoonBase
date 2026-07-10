import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Activity, LayoutDashboard, Terminal, Database, Zap, MessageSquare, Layers, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from './api';
import { useQueryClient } from '@tanstack/react-query';
import { useProducts, useTasks, usePriceHistory } from './hooks/useProducts';
import { useScrapeController } from './hooks/useScrapeController';
import { useGlobalFilters } from './hooks/useGlobalFilters';
import { PageSpinner } from './components/PageSpinner';
import { PriceTrendModal } from './components/PriceTrendModal';
import { ThemeToggle } from './components/ThemeToggle';

const OverviewPage = lazy(() => import('./pages/OverviewPage').then(m => ({ default: m.OverviewPage })));
const ScraperPage = lazy(() => import('./pages/ScraperPage').then(m => ({ default: m.ScraperPage })));
const FetcherPage = lazy(() => import('./pages/FetcherPage').then(m => ({ default: m.FetcherPage })));
const DatabasePage = lazy(() => import('./pages/DatabasePage').then(m => ({ default: m.DatabasePage })));
const SkuAnalysisPage = lazy(() => import('./pages/SkuAnalysisPage').then(m => ({ default: m.SkuAnalysisPage })));
const CategoryAnalysisPage = lazy(() => import('./pages/CategoryAnalysisPage').then(m => ({ default: m.CategoryAnalysisPage })));
const SystemLogsPage = lazy(() => import('./components/SystemLogsPage').then(m => ({ default: m.SystemLogsPage })));

type TabId = 'overview' | 'scraper' | 'fetcher' | 'database' | 'sku' | 'category' | 'logs';
const NAV_ITEMS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: '大盘总览', icon: LayoutDashboard },
  { id: 'scraper', label: '付费搜查', icon: Terminal },
  { id: 'fetcher', label: '本地直搜', icon: Zap },
  { id: 'database', label: '数据库', icon: Database },
  { id: 'sku', label: '单品分析', icon: MessageSquare },
  { id: 'category', label: '类目分析', icon: Layers },
  { id: 'logs', label: '系统日志', icon: Terminal },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const sc = useScrapeController();
  const gf = useGlobalFilters();
  const { data: listData } = useProducts(gf.listParams);
  const { data: tasks = [] } = useTasks();
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const { data: priceHistory = [], refetch: refetchPriceHistory } = usePriceHistory(selectedSku);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrapePages, setScrapePages] = useState(1);
  const [scrapeProvider, setScrapeProvider] = useState<'scraperapi' | 'oxylabs'>('scraperapi');
  const [fetcherQuery, setFetcherQuery] = useState('');
  const [fetcherPages, setFetcherPages] = useState(1);
  const [analysisSku, setAnalysisSku] = useState<string | undefined>(undefined);
  const [autoRunAnalysis, setAutoRunAnalysis] = useState(false);

  useEffect(() => {
    if (drawerOpen) { document.body.style.overflow = 'hidden'; document.querySelector<HTMLElement>('#sidebar .nav-item')?.focus(); }
    else { document.body.style.overflow = ''; hamburgerRef.current?.focus(); }
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const handleScrape = async (e: React.FormEvent) => { e.preventDefault(); if (!searchQuery.trim()) return; await sc.triggerScrape(searchQuery, scrapePages, scrapeProvider); setSearchQuery(''); };
  const handleFetcherScrape = async (e: React.FormEvent) => { e.preventDefault(); if (!fetcherQuery.trim()) return; await sc.triggerScrape(fetcherQuery, fetcherPages, 'fetcher'); setFetcherQuery(''); };
  const handleBatchDelete = async (skus: string[]) => {
    if (!skus.length) return;
    if (!confirm(`确定要将选中的 ${skus.length} 个商品移出监控池吗？(大盘将不再统计其数据)`)) return;
    try { await Promise.all(skus.map(sku => api.delete(`/products/${encodeURIComponent(sku)}`))); queryClient.invalidateQueries({ queryKey: ['products'] }); queryClient.invalidateQueries({ queryKey: ['stats'] }); queryClient.invalidateQueries({ queryKey: ['categories'] }); queryClient.invalidateQueries({ queryKey: ['overview'] }); }
    catch (e) { console.error('Batch delete failed', e); alert('部分删除失败，请检查控制台。'); }
  };

  const renderNav = (onItemClick: () => void) => (
    <nav className="nav-menu" aria-label="主导航">
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" className={`nav-item ${activeTab === id ? 'active' : ''}`} aria-current={activeTab === id ? 'page' : undefined} onClick={() => { setActiveTab(id); onItemClick(); }}>
          <Icon size={20} aria-hidden="true" /><span>{label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="app-container">
      <div className="app-background" aria-hidden="true" />
      <a href="#main-content" className="skip-link">跳到主内容</a>
      <aside id="sidebar" className={`sidebar ${drawerOpen ? 'open' : ''}`} aria-label="侧边导航">
        <div className="sidebar-logo"><Activity size={24} color="var(--primary)" aria-hidden="true" /><span>一森数字科技</span></div>
        {renderNav(() => setDrawerOpen(false))}
        <div className="sidebar-footer">
          <ThemeToggle />
          <div className="status-pill" role="status" aria-label="系统状态：在线"><span className="status-dot" aria-hidden="true" /><div><p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Status</p><span style={{ fontWeight: 500 }}>System Online</span></div></div>
        </div>
      </aside>
      {drawerOpen && <div className="sidebar-overlay open" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      <div className="content">
        <header className="topbar">
          <button ref={hamburgerRef} type="button" className="icon-btn" aria-label="打开导航菜单" aria-expanded={drawerOpen} aria-controls="sidebar" onClick={() => setDrawerOpen(true)}><Menu size={20} aria-hidden="true" /></button>
          <span className="topbar-title">NOON 洞察</span>
          <span className="topbar-spacer" />
          <ThemeToggle />
          <span className="status-pill" role="status" aria-label="系统状态：在线"><span className="status-dot" aria-hidden="true" /><span>在线</span></span>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <Suspense fallback={<PageSpinner />}>
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && <OverviewPage key="overview" filterText={gf.filterText} onFilterTextChange={gf.setFilterText} selectedCategory={gf.selectedCategory} onCategoryChange={gf.setSelectedCategory} categoryTabs={gf.categoryTabs} overviewParams={gf.overviewParams} />}
              {activeTab === 'scraper' && <ScraperPage key="scraper" searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} scrapePages={scrapePages} onScrapePagesChange={setScrapePages} scrapeProvider={scrapeProvider} onScrapeProviderChange={setScrapeProvider} scraping={sc.scraping} waitingForLog={sc.waitingForLog} onSubmit={handleScrape} tasks={tasks} />}
              {activeTab === 'fetcher' && <FetcherPage key="fetcher" fetcherQuery={fetcherQuery} onFetcherQueryChange={setFetcherQuery} fetcherPages={fetcherPages} onFetcherPagesChange={setFetcherPages} scraping={sc.scraping} waitingForLog={sc.waitingForLog} onSubmit={handleFetcherScrape} tasks={tasks} />}
              {activeTab === 'database' && <DatabasePage key="database" items={listData?.items ?? []} total={listData?.total ?? 0} page={gf.page} pageSize={gf.pageSize} onPageChange={gf.setPage} onPageSizeChange={gf.setPageSize} onSortingChange={gf.setSort} selectedCategory={gf.selectedCategory} onCategoryChange={gf.setSelectedCategory} categoryTabs={gf.categoryTabs} onRowClick={(sku: string) => setSelectedSku(sku)} onBatchDelete={handleBatchDelete} />}
              {activeTab === 'sku' && <motion.div key="sku" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><SkuAnalysisPage initialSku={analysisSku} autoRun={autoRunAnalysis} onAutoRunConsumed={() => setAutoRunAnalysis(false)} onExecutionUpdate={sc.handleAnalysisExecutionUpdate} /></motion.div>}
              {activeTab === 'category' && <motion.div key="category" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><CategoryAnalysisPage categoryTabs={gf.categoryTabs} onExecutionUpdate={sc.handleAnalysisExecutionUpdate} /></motion.div>}
              {activeTab === 'logs' && <motion.div key="logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} style={{ height: 'calc(100% - 0.5rem)' }}><SystemLogsPage blocks={sc.executionBlocks} onClear={sc.clearExecutionBlocks} /></motion.div>}
            </AnimatePresence>
          </Suspense>
        </main>
      </div>
      <PriceTrendModal selectedSku={selectedSku} priceHistory={priceHistory} refetchPriceHistory={refetchPriceHistory} onClose={() => setSelectedSku(null)} onGoToAnalysis={(sku) => { setAnalysisSku(sku); setAutoRunAnalysis(true); setActiveTab('sku'); setSelectedSku(null); }} />
    </div>
  );
}
