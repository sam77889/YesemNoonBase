import { useState, useEffect, useMemo, useRef } from 'react';
import { Activity, LayoutDashboard, Terminal, Database, Zap, MessageSquare, X, RefreshCw } from 'lucide-react';
import { ReviewAnalysisPage } from './components/ReviewAnalysisPage';
import { SystemLogsPage } from './components/SystemLogsPage';
import { OverviewPage } from './pages/OverviewPage';
import { ScraperPage } from './pages/ScraperPage';
import { FetcherPage } from './pages/FetcherPage';
import { DatabasePage } from './pages/DatabasePage';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { api } from './api';
import type { Product } from './api';
import { useProducts, useStats, useTasks, usePriceHistory } from './hooks/useProducts';
import { useQueryClient } from '@tanstack/react-query';

const parseScrapedAt = (scrapedAt: string) => new Date(scrapedAt.endsWith('Z') ? scrapedAt : scrapedAt + 'Z');

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: string | number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(15, 17, 26, 0.9)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#f8fafc' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: 0, color: entry.color, fontSize: '0.875rem' }}>
            {entry.name}: <span style={{ fontWeight: 600 }}>{typeof entry.value === 'number' && !Number.isInteger(entry.value) ? Number(entry.value).toFixed(2) : entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Normalize category function
const normalizeCategory = (category: string | null, title: string | null): string => {
  const c = (category || '').toLowerCase().trim();
  if (['massage gun', 'massage guns', 'massage muscle stimulators', 'massager', 'neck massager', 'eye massager'].includes(c)) return '按摩器';
  if (c === 'handheld fan') return '手持风扇';
  if (['ice tray', 'ice mold', 'ice cube trays', 'ice cube tray'].includes(c)) return '冰格';
  if (['egg boiler', 'egg cooker', 'egg steamer'].includes(c)) return '煮蛋器';
  if (['yoga mat', 'yoga mats'].includes(c)) return '瑜伽垫';
  const t = (title || '').toLowerCase();
  if (c === 'home appliances' || !c) {
    if (t.includes('massage gun') || t.includes('percussion')) return '按摩器';
    if (t.includes('massager') || t.includes('massage')) return '按摩器';
    if (t.includes('fan')) return '手持风扇';
    if (t.includes('ice') && (t.includes('tray') || t.includes('mold') || t.includes('cube'))) return '冰格';
    if (t.includes('egg') && (t.includes('boil') || t.includes('cook'))) return '煮蛋器';
    if (t.includes('yoga') && t.includes('mat')) return '瑜伽垫';
  }
  return '未分类';
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'scraper' | 'database' | 'fetcher' | 'analysis' | 'logs'>('overview');
  const [executionBlocks, setExecutionBlocks] = useState<{
    id: string;
    title: string;
    source: 'analysis' | 'scraper' | 'fetcher';
    status: 'running' | 'success' | 'error';
    timestamp: Date;
    logs: { id: string; timestamp: Date; message: string; type: 'info' | 'success' | 'error' }[];
    progress: number;
  }[]>([]);
  const queryClient = useQueryClient();

  const handleExecutionUpdate = (id: string, title: string, source: 'analysis' | 'scraper' | 'fetcher', status: 'running' | 'success' | 'error', progress: number, logs: string[]) => {
    setExecutionBlocks(prev => {
      const newBlocks = [...prev];
      const idx = newBlocks.findIndex(b => b.id === id);
      const parsedLogs = logs.map((msg, i) => ({
        id: `${id}-log-${i}`,
        timestamp: new Date(),
        message: msg,
        type: msg.includes('错误') ? 'error' : msg.includes('完成') ? 'success' : 'info' as 'info' | 'success' | 'error'
      }));
      if (idx === -1) {
        newBlocks.unshift({ id, title, source, status, timestamp: new Date(), logs: parsedLogs, progress });
      } else {
        newBlocks[idx] = { ...newBlocks[idx], status, logs: parsedLogs, progress };
      }
      return newBlocks;
    });
  };

  // React Query hooks
  const { data: stats } = useStats();
  const { data: products = [] } = useProducts();
  const { data: tasks = [] } = useTasks();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterText, setFilterText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [scraping, setScraping] = useState(false);
  const [scrapePages, setScrapePages] = useState(1);
  const [scrapeProvider, setScrapeProvider] = useState<'scraperapi' | 'oxylabs'>('scraperapi');
  const [fetcherQuery, setFetcherQuery] = useState('');
  const [fetcherPages, setFetcherPages] = useState(1);
  const fetcherTerminalRef = useRef<HTMLDivElement | null>(null);
  const sortConfig = { key: 'review_count' as keyof Product, direction: 'desc' as 'asc' | 'desc' };
  const [waitingForLog, setWaitingForLog] = useState(false);
  const terminalRef = useRef<HTMLDivElement | null>(null);

  // Modal state for Price Trend
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const { data: priceHistory = [], refetch: refetchPriceHistory } = usePriceHistory(selectedSku);
  const [isRefreshingSku, setIsRefreshingSku] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // State for Review Analysis Page
  const [analysisSku, setAnalysisSku] = useState<string | undefined>(undefined);
  const [autoRunAnalysis, setAutoRunAnalysis] = useState<boolean>(false);

  // Cleanup refresh interval on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  const triggerScrape = async (query: string, pages: number, provider: 'fetcher' | 'scraperapi' | 'oxylabs') => {
    setScraping(true);
    setWaitingForLog(true);
    try {
      const res = await api.post('/tasks/search', {
        task_type: 'SEARCH',
        query,
        country: 'uae',
        language: 'en',
        pages,
        provider
      });

      const jobId = res.data.job_id;
      if (jobId) {
        const initialLog = provider === 'fetcher'
          ? '> 建立网络请求上下文...\n> 注入浏览器特征指纹，规避 Akamai Bot Manager...'
          : '> 正在向代理池下发任务，分配高匿节点...';

        const title = `${provider === 'fetcher' ? '本地直搜' : '付费搜查'} - ${query}`;
        handleExecutionUpdate(jobId, title, provider === 'fetcher' ? 'fetcher' : 'scraper', 'running', 10, initialLog.split('\n'));
      }

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    } catch (error) {
      console.error('Scraping failed:', error);
      alert('Failed to start scraping task.');
    } finally {
      setScraping(false);
      setTimeout(() => setWaitingForLog(false), 1500);
    }
  };

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setTimeout(() => {
      terminalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    await triggerScrape(searchQuery, scrapePages, scrapeProvider);
    setSearchQuery('');
  };

  const handleFetcherScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fetcherQuery.trim()) return;
    setTimeout(() => {
      fetcherTerminalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    await triggerScrape(fetcherQuery, fetcherPages, 'fetcher');
    setFetcherQuery('');
  };

  // Listen for task status changes
  useEffect(() => {
    const activeTask = tasks.find(t => (t.status === 'PROCESSING' || t.status === 'PENDING'));
    if (waitingForLog && activeTask) {
      setWaitingForLog(false);
    }

    setExecutionBlocks(prevBlocks => {
      const newBlocks = [...prevBlocks];
      let changed = false;

      tasks.forEach(task => {
        const blockIndex = newBlocks.findIndex(b => b.id === task.job_id);
        const source = task.job_id?.startsWith('fetcher-') ? 'fetcher' : 'scraper';
        const title = `${source === 'fetcher' ? '本地直搜' : '付费搜查'} - ${task.query}`;

        let logs: { id: string; timestamp: Date; message: string; type: 'info' | 'success' | 'error' }[] = [];
        if (task.error_message) {
          logs = task.error_message.split('\n').filter(Boolean).map((msg, i) => ({
            id: `log-${task.job_id}-${i}`,
            timestamp: new Date(),
            message: msg,
            type: (msg.includes('Error') || msg.includes('Failed') ? 'error' : 'info') as 'info' | 'success' | 'error'
          }));
        }

        const status = task.status === 'SUCCESS' ? 'success' : task.status === 'FAILED' ? 'error' : 'running';
        const progress = status === 'success' ? 100 : (status === 'error' ? 100 : 50);

        if (blockIndex === -1) {
          if (task.job_id) {
            newBlocks.unshift({ id: task.job_id, title, source, status, timestamp: new Date(), logs, progress });
            changed = true;
          }
        } else {
          const existing = newBlocks[blockIndex];
          if (existing.status !== status || existing.logs.length !== logs.length) {
            newBlocks[blockIndex] = { ...existing, status, logs, progress };
            changed = true;
          }
        }
      });
      return changed ? newBlocks : prevBlocks;
    });
  }, [tasks, waitingForLog]);

  const openPriceTrend = async (sku: string) => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
    setSelectedSku(sku);
  };

  const handleBatchDeleteWithSkus = async (skus: string[]) => {
    if (skus.length === 0) return;
    if (!confirm(`确定要将选中的 ${skus.length} 个商品移出监控池吗？(大盘将不再统计其数据)`)) return;

    try {
      await Promise.all(
        skus.map(sku => api.delete(`/products/${encodeURIComponent(sku)}`))
      );
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    } catch (e) {
      console.error('Batch delete failed', e);
      alert('部分删除失败，请检查控制台。');
    }
  };

  // Category tabs
  const categoryTabs = useMemo(() => {
    const counts = new Map<string, number>();
    (Array.isArray(products) ? products : []).forEach(p => {
      const label = normalizeCategory(p.category, p.title);
      if (label === '未分类') return;
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (selectedCategory !== 'All') {
      result = result.filter(p => normalizeCategory(p.category, p.title) === selectedCategory);
    }
    if (filterText.trim()) {
      const lowerFilter = filterText.toLowerCase();
      result = result.filter(p =>
        (p.title && p.title.toLowerCase().includes(lowerFilter)) ||
        (p.brand && p.brand.toLowerCase().includes(lowerFilter)) ||
        (p.category && p.category.toLowerCase().includes(lowerFilter))
      );
    }
    if (sortConfig.key) {
      result.sort((a, b) => {
        const valA = a[sortConfig.key as keyof Product] || 0;
        const valB = b[sortConfig.key as keyof Product] || 0;
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [products, filterText, selectedCategory, sortConfig]);

  return (
    <div className="app-container">
      <div className="app-background"></div>

      <aside className="sidebar">
        <div className="sidebar-logo">
          <Activity size={28} color="var(--primary)" />
          <span>一森数字科技</span>
        </div>

        <nav className="nav-menu">
          <div className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <LayoutDashboard size={20} />
            <span>大盘总览</span>
          </div>
          <div className={`nav-item ${activeTab === 'scraper' ? 'active' : ''}`} onClick={() => setActiveTab('scraper')}>
            <Terminal size={20} />
            <span>付费搜查</span>
          </div>
          <div className={`nav-item ${activeTab === 'fetcher' ? 'active' : ''}`} onClick={() => setActiveTab('fetcher')}>
            <Zap size={20} />
            <span>本地直搜</span>
          </div>
          <div className={`nav-item ${activeTab === 'database' ? 'active' : ''}`} onClick={() => setActiveTab('database')}>
            <Database size={20} />
            <span>数据库</span>
          </div>
          <div className={`nav-item ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
            <MessageSquare size={20} />
            <span>深度分析</span>
          </div>
          <div className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
            <Terminal size={20} />
            <span>系统日志</span>
          </div>
        </nav>

        <div style={{ marginTop: 'auto', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</p>
          <div className="flex items-center gap-2" style={{ marginTop: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></span>
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>System Online</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <OverviewPage
              key="overview"
              stats={stats ?? null}
              products={products}
              filterText={filterText}
              onFilterTextChange={setFilterText}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              categoryTabs={categoryTabs}
              filteredProducts={filteredProducts}
            />
          )}

          {activeTab === 'scraper' && (
            <ScraperPage
              key="scraper"
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              scrapePages={scrapePages}
              onScrapePagesChange={setScrapePages}
              scrapeProvider={scrapeProvider}
              onScrapeProviderChange={setScrapeProvider}
              scraping={scraping}
              waitingForLog={waitingForLog}
              onSubmit={handleScrape}
              tasks={tasks}
            />
          )}

          {activeTab === 'fetcher' && (
            <FetcherPage
              key="fetcher"
              fetcherQuery={fetcherQuery}
              onFetcherQueryChange={setFetcherQuery}
              fetcherPages={fetcherPages}
              onFetcherPagesChange={setFetcherPages}
              scraping={scraping}
              waitingForLog={waitingForLog}
              onSubmit={handleFetcherScrape}
              tasks={tasks}
            />
          )}

          {activeTab === 'database' && (
            <DatabasePage
              key="database"
              filteredProducts={filteredProducts}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              categoryTabs={categoryTabs}
              onRowClick={openPriceTrend}
              onBatchDelete={handleBatchDeleteWithSkus}
            />
          )}

          {activeTab === 'analysis' && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ReviewAnalysisPage
                initialSku={analysisSku}
                autoRun={autoRunAnalysis}
                onAutoRunConsumed={() => setAutoRunAnalysis(false)}
                onExecutionUpdate={handleExecutionUpdate}
                categoryTabs={categoryTabs}
              />
            </motion.div>
          )}

          {activeTab === 'logs' && (
            <motion.div
              key="logs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ height: 'calc(100vh - 4rem)' }}
            >
              <SystemLogsPage blocks={executionBlocks} onClear={() => setExecutionBlocks([])} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Price Trend Modal */}
      <AnimatePresence>
        {selectedSku && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setSelectedSku(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 10, opacity: 0 }}
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
                <div>
                  <h2 style={{ marginBottom: '0.25rem' }}>价格波动趋势</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>SKU: {selectedSku}</p>
                </div>
                <button
                  onClick={() => setSelectedSku(null)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-main)', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--success)' }}>
                  提示：销量趋势 = 最近两次抓取的评价数 (review_count) 之差 ÷ 1% 留评率估算得出
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '8px', cursor: 'pointer', background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
                    onClick={() => {
                      if (!selectedSku) return;
                      setAnalysisSku(selectedSku);
                      setActiveTab('analysis');
                      setSelectedSku(null);
                    }}
                  >
                    深度分析
                  </button>
                  <button
                    className="btn"
                    disabled={isRefreshingSku}
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '8px', opacity: isRefreshingSku ? 0.7 : 1, cursor: isRefreshingSku ? 'not-allowed' : 'pointer' }}
                    onClick={async () => {
                      if (isRefreshingSku) return;
                      setIsRefreshingSku(true);
                      try {
                        await api.post('/tasks/search', {
                          task_type: 'SEARCH',
                          query: selectedSku,
                          country: 'uae',
                          language: 'en',
                          provider: 'fetcher'
                        });

                        queryClient.invalidateQueries({ queryKey: ['products'] });

                        const startTime = Date.now();
                        let attempts = 0;
                        const pollInterval = setInterval(async () => {
                          attempts++;
                          try {
                            const res = await api.get(`/products/${encodeURIComponent(selectedSku!)}/prices`);
                            const rawData = res.data as { scraped_at: string; price: number | null; original_price: number | null; review_count: number }[];
                            const hasNewData = rawData.some((item) => parseScrapedAt(item.scraped_at).getTime() > startTime - 10000);

                            if (hasNewData || attempts >= 15) {
                              clearInterval(pollInterval);
                              refetchPriceHistory();
                              setIsRefreshingSku(false);
                            }
                          } catch (err) {
                            console.error(err);
                            if (attempts >= 15) {
                              clearInterval(pollInterval);
                              setIsRefreshingSku(false);
                            }
                          }
                        }, 3000);
                      } catch (e) {
                        console.error(e);
                        setIsRefreshingSku(false);
                      }
                    }}
                  >
                    <RefreshCw size={14} className={isRefreshingSku ? "spin" : ""} />
                    {isRefreshingSku ? "抓取中..." : "最新数据"}
                  </button>
                </div>
              </div>

              <div style={{ width: '100%', height: '350px' }}>
                {priceHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="time" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis yAxisId="left" stroke="#60a5fa" fontSize={12} tickLine={false} axisLine={false} domain={[(dataMin: number) => Math.max(0, dataMin - 20), 'dataMax + 20']} tickFormatter={(v) => typeof v === 'number' && !Number.isInteger(v) ? Number(v).toFixed(2) : v} />
                      <YAxis yAxisId="right" orientation="right" stroke="#34d399" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin', 'auto']} tickFormatter={(v) => typeof v === 'number' && !Number.isInteger(v) ? Number(v).toFixed(2) : v} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line yAxisId="left" type="monotone" dataKey="price" name="实时售价 (AED)" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--primary)" }} activeDot={{ r: 6 }} />
                      <Line yAxisId="left" type="monotone" dataKey="original_price" name="原始标价" stroke="var(--text-muted)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="stepAfter" dataKey="review_count" name="累计评价数" stroke="var(--success)" strokeWidth={3} dot={{ r: 4, fill: "var(--success)" }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center" style={{ height: '100%', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw className="spin" size={24} />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        .blinking-cursor { animation: blink 1s step-end infinite; }
      `}</style>
    </div>
  );
}
