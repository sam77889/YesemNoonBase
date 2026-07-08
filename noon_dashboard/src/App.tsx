import { useState, useEffect, useMemo, useRef } from 'react';
import { Activity, Search, Package, TrendingUp, RefreshCw, X, BarChart3, LayoutDashboard, Terminal, Database, Play, Zap, MessageSquare } from 'lucide-react';
import { DatabaseTable } from './components/DatabaseTable';
import { CustomSelect } from './components/CustomSelect';
import { ReviewAnalysisPage } from './components/ReviewAnalysisPage';
import { SystemLogsPage } from './components/SystemLogsPage';

import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ComposedChart,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import { api } from './api';
import type { Product, Stats, Task } from './api';


const parseScrapedAt = (scrapedAt: string) => new Date(scrapedAt.endsWith('Z') ? scrapedAt : scrapedAt + 'Z');

// Custom Tooltip for dark mode
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(15, 17, 26, 0.9)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#f8fafc' }}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ margin: 0, color: entry.color, fontSize: '0.875rem' }}>
            {entry.name}: <span style={{ fontWeight: 600 }}>{typeof entry.value === 'number' && !Number.isInteger(entry.value) ? Number(entry.value).toFixed(2) : entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'scraper' | 'database' | 'fetcher' | 'analysis' | 'logs'>('overview');
  const [executionBlocks, setExecutionBlocks] = useState<any[]>([]);

  const handleExecutionUpdate = (id: string, title: string, source: 'analysis', status: 'running' | 'success' | 'error', progress: number, logs: string[]) => {
    setExecutionBlocks(prev => {
      const newBlocks = [...prev];
      const idx = newBlocks.findIndex(b => b.id === id);
      const parsedLogs = logs.map((msg, i) => ({
        id: `${id}-log-${i}`,
        timestamp: new Date(),
        message: msg,
        type: msg.includes('错误') ? 'error' : msg.includes('完成') ? 'success' : 'info'
      }));
      if (idx === -1) {
        newBlocks.unshift({ id, title, source, status, timestamp: new Date(), logs: parsedLogs, progress });
      } else {
        newBlocks[idx] = { ...newBlocks[idx], status, logs: parsedLogs, progress };
      }
      return newBlocks;
    });
  };

  
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterText, setFilterText] = useState(''); 
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [scraping, setScraping] = useState(false);
  const [scrapePages, setScrapePages] = useState(1); // 抓取深度页数
  const [scrapeProvider, setScrapeProvider] = useState<'scraperapi' | 'oxylabs'>('scraperapi'); // 抓取引擎（付费 API）
  // 本地直搜（独立页面）专用状态
  const [fetcherQuery, setFetcherQuery] = useState('');
  const [fetcherPages, setFetcherPages] = useState(1);
  const fetcherTerminalRef = useRef<HTMLDivElement>(null);
  const sortConfig = {key: 'review_count', direction: 'desc'};
  const [waitingForLog, setWaitingForLog] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  
  // Modal state for Price Trend
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [isRefreshingSku, setIsRefreshingSku] = useState(false);

  // State for Review Analysis Page
  const [analysisSku, setAnalysisSku] = useState<string | undefined>(undefined);

  const fetchData = async () => {
    try {
      const [statsRes, prodRes, taskRes] = await Promise.all([
        api.get<Stats>('/products/stats'),
        api.get<Product[]>('/products/?limit=10000'), // Fetch up to 10000 for better local filtering
        api.get<Task[]>('/tasks/?limit=20')
      ]);
      setStats(statsRes.data && typeof statsRes.data === 'object' ? statsRes.data : null);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
      const taskData = taskRes.data;
      if (!Array.isArray(taskData)) {
        console.warn('[fetchData] /tasks/ 返回非数组，已忽略:', taskData);
      }
      setTasks(Array.isArray(taskData) ? taskData : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const triggerScrape = async (query: string, pages: number, provider: 'fetcher' | 'scraperapi' | 'oxylabs') => {
    setScraping(true);
    setWaitingForLog(true);
    try {
      await api.post('/tasks/search', {
        task_type: 'SEARCH',
        query,
        country: 'uae',
        language: 'en',
        pages,
        provider
      });
      fetchData();
    } catch (error) {
      console.error('Scraping failed:', error);
      alert('Failed to start scraping task.');
    } finally {
      setScraping(false);
      // 保证一定能解除锁定
      setTimeout(() => setWaitingForLog(false), 1500);
    }
  };

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    // 触发平滑滚动到终端区域
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

  // 监听任务状态，如果有正在跑的任务，可以立即解除锁定
  useEffect(() => {
    const activeTask = tasks.find(t => t.status === 'RUNNING');
    if (waitingForLog && activeTask) {
      setWaitingForLog(false);
    }
    
    // Parse backend tasks into execution blocks
    setExecutionBlocks(prevBlocks => {
      const newBlocks = [...prevBlocks];
      let changed = false;

      tasks.forEach(task => {
        const blockIndex = newBlocks.findIndex(b => b.id === task.job_id);
        const source = task.job_id?.startsWith('fetcher-') ? 'fetcher' : 'scraper';
        const title = `${source === 'fetcher' ? '本地直搜' : '付费搜查'} - ${task.query}`;
        
        let logs: any[] = [];
        if (task.error_message) {
          logs = task.error_message.split('\n').filter(Boolean).map((msg, i) => ({
            id: `log-${task.job_id}-${i}`,
            timestamp: new Date(),
            message: msg,
            type: msg.includes('Error') || msg.includes('Failed') ? 'error' : 'info'
          }));
        }

        const status = task.status === 'SUCCESS' ? 'success' : task.status === 'FAILED' ? 'error' : 'running';
        const progress = status === 'success' ? 100 : (status === 'error' ? 100 : 50);

        if (blockIndex === -1) {
          if (task.job_id) {
            newBlocks.unshift({
              id: task.job_id,
              title,
              source,
              status,
              timestamp: new Date(),
              logs,
              progress
            });
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
    setSelectedSku(sku);
    setPriceHistory([]);
    try {
      const safeSku = encodeURIComponent(sku);
      const res = await api.get(`/products/${safeSku}/prices`);
      const dailyMap = new Map();
      const sortedData = res.data.sort((a: any, b: any) => parseScrapedAt(a.scraped_at).getTime() - parseScrapedAt(b.scraped_at).getTime());
      
      sortedData.forEach((item: any) => {
        const date = parseScrapedAt(item.scraped_at);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        
        dailyMap.set(`${yyyy}-${mm}-${dd}`, {
          time: `${yyyy}-${mm}-${dd}`,
          price: item.price != null ? Number(Number(item.price).toFixed(2)) : item.price,
          original_price: item.original_price != null ? Number(Number(item.original_price).toFixed(2)) : item.original_price,
          review_count: item.review_count || 0
        });
      });
      
      setPriceHistory(Array.from(dailyMap.values()));
    } catch (e) {
      console.error(e);
    }
  };


  const handleBatchDeleteWithSkus = async (skus: string[]) => {
    if (skus.length === 0) return;
    if (!confirm(`确定要将选中的 ${skus.length} 个商品移出监控池吗？(大盘将不再统计其数据)`)) return;
    
    try {
      await Promise.all(
        skus.map(sku => api.delete(`/products/${encodeURIComponent(sku)}`))
      );
      const skuSet = new Set(skus);
      setProducts(prev => prev.filter(p => !skuSet.has(p.sku)));
    } catch (e) {
      console.error('Batch delete failed', e);
      alert('部分删除失败，请检查控制台。');
    }
  };


  // ── Data Processing for Charts & Categories ──
  
  // 商品分类归一化：把各种 category 值（搜索词 + noon nudges 品类名）统一映射到标准中文标签。
  // 解决：① 同义分类重复（massage gun / Massage Guns / Massage Muscle Stimulators）
  //       ② 拆词匹配 title 导致 fan/handheld 混入其他品类。
  const normalizeCategory = (category: string | null, title: string | null): string => {
    const c = (category || '').toLowerCase().trim();
    if (['massage gun', 'massage guns', 'massage muscle stimulators', 'massager', 'neck massager', 'eye massager'].includes(c)) return '按摩器';
    if (c === 'handheld fan') return '手持风扇';
    if (['ice tray', 'ice mold', 'ice cube trays', 'ice cube tray'].includes(c)) return '冰格';
    if (['egg boiler', 'egg cooker', 'egg steamer'].includes(c)) return '煮蛋器';
    if (['yoga mat', 'yoga mats'].includes(c)) return '瑜伽垫';
    // 宽泛品类（Home Appliances）或空 category：用 title 补判
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

  // 分类标签：基于商品 category 字段归一化聚合（不再依赖 tasks query，去重且精确）
  const categoryTabs = useMemo(() => {
    const counts = new Map<string, number>();
    (Array.isArray(products) ? products : []).forEach(p => {
      const label = normalizeCategory(p.category, p.title);
      if (label === '未分类') return; // 未分类不显示标签
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]); // [label, count] 按数量降序
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = products;
    
    // Apply Tab Category Filter (按归一化 category 精确匹配，避免拆词匹配 title 的混乱)
    if (selectedCategory !== 'All') {
      result = result.filter(p => normalizeCategory(p.category, p.title) === selectedCategory);
    }
    
    // Apply Text Search Filter
    if (filterText.trim()) {
      const lowerFilter = filterText.toLowerCase();
      result = result.filter(p => 
        (p.title && p.title.toLowerCase().includes(lowerFilter)) || 
        (p.brand && p.brand.toLowerCase().includes(lowerFilter)) ||
        (p.category && p.category.toLowerCase().includes(lowerFilter))
      );
    }
    
    // Apply Sorting
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

  const priceDistribution = useMemo(() => {
    if (!filteredProducts.length) return [];
    
    const prices = filteredProducts
      .map(p => p.price)
      .filter((price): price is number => price !== null && price !== undefined && price > 0)
      .sort((a, b) => a - b);
      
    if (prices.length === 0) return [];

    let minPrice = prices[0];
    let maxPrice = prices[prices.length - 1];

    if (prices.length > 4) {
      const q1 = prices[Math.floor(prices.length * 0.25)];
      const q3 = prices[Math.floor(prices.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = Math.max(0, q1 - 1.5 * iqr);
      const upperBound = q3 + 1.5 * iqr;
      
      const validPrices = prices.filter(p => p >= lowerBound && p <= upperBound);
      if (validPrices.length > 0) {
        minPrice = validPrices[0];
        maxPrice = validPrices[validPrices.length - 1];
      }
    }

    if (minPrice === Infinity || minPrice === maxPrice) {
      return [{ name: `${minPrice || 0}`, productCount: filteredProducts.length, totalReviews: 0 }];
    }

    const bucketCount = 20;
    const interval = (maxPrice - minPrice + 0.01) / bucketCount; 
    
    const bucketsProductCount = Array(bucketCount).fill(0);
    const bucketsReviewCount = Array(bucketCount).fill(0);
    const bucketLabels = Array(bucketCount).fill('');

    for (let i = 0; i < bucketCount; i++) {
      const start = Math.floor(minPrice + i * interval);
      const end = i === bucketCount - 1 ? Math.ceil(maxPrice) : Math.floor(minPrice + (i + 1) * interval - 1);
      bucketLabels[i] = `${start}-${end}`;
    }

    filteredProducts.forEach(p => {
      const price = p.price;
      const reviews = p.review_count || 0;
      if (price !== null && price !== undefined && price >= minPrice && price <= maxPrice) {
        const index = Math.floor((price - minPrice) / interval);
        const safeIndex = Math.min(Math.max(index, 0), bucketCount - 1);
        bucketsProductCount[safeIndex]++;
        bucketsReviewCount[safeIndex] += reviews;
      }
    });

    return bucketLabels.map((label, i) => ({
      name: label,
      productCount: bucketsProductCount[i],
      totalReviews: bucketsReviewCount[i]
    })).filter(d => d.productCount > 0); 
  }, [filteredProducts]);

  // Dynamic stats based on selected category
  const dynamicStats = useMemo(() => {
    if (selectedCategory === 'All') return stats;
    return {
      total_products: filteredProducts.length,
      active_products: filteredProducts.filter(p => p.price !== null).length,
      total_snapshots: filteredProducts.reduce((sum, p) => sum + (p.review_count || 0), 0)
    };
  }, [filteredProducts, selectedCategory, stats]);

  // 价格销量分布图数据（预估销量 = 评论数*38 + 低价加成 + 评分加成）
  const scatterData = useMemo(() => {
    return filteredProducts
      .filter(p => p.price != null && p.price > 0)
      .map(p => {
        const sales = Math.floor((p.review_count || 0) * 38 + 1500 / Math.max(p.price || 1, 10) + (p.rating || 3.5) * 20);
        return {
          name: (p.title || '').slice(0, 20),
          price: p.price,
          sales,
          reviews: p.review_count || 0,
          rating: p.rating || 0,
        };
      });
  }, [filteredProducts]);

  // 品牌竞争力 TOP10
  const brandRanking = useMemo(() => {
    if (!filteredProducts.length) return [];
    const brandMap: Record<string, { count: number; totalReviews: number; totalRating: number; ratedCount: number }> = {};

    filteredProducts.forEach(p => {
      const brand = (p.brand || '').toUpperCase().trim() || '白牌';
      if (!brandMap[brand]) brandMap[brand] = { count: 0, totalReviews: 0, totalRating: 0, ratedCount: 0 };
      brandMap[brand].count++;
      brandMap[brand].totalReviews += (p.review_count || 0);
      if (p.rating) {
        brandMap[brand].totalRating += p.rating;
        brandMap[brand].ratedCount++;
      }
    });

    return Object.entries(brandMap)
      .map(([name, d]) => ({
        name: name.length > 12 ? name.slice(0, 12) + '…' : name,
        商品数: d.count,
        总评论: d.totalReviews,
        均分: d.ratedCount > 0 ? Math.round(d.totalRating / d.ratedCount * 10) / 10 : 0,
      }))
      .sort((a, b) => b.总评论 - a.总评论)
      .slice(0, 10);
  }, [filteredProducts]);

  return (
    <div className="app-container">
      {/* Animated Mesh Gradient Background */}
      <div className="app-background"></div>

      {/* Sidebar Navigation */}
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

      {/* Main Content Workspace */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          
          {/* ===================== OVERVIEW TAB ===================== */}
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <h1>大盘总览</h1>
                  <p style={{ color: 'var(--text-muted)' }}>您的实时电商洞察指挥中心</p>
                </div>
                <div style={{ position: 'relative', width: '300px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="过滤特定商品 (如 massage gun)..." 
                    style={{ paddingLeft: '2.5rem', borderRadius: '20px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                  />
                </div>
              </div>

              {/* Category Horizontal Tabs */}
              <div className="flex gap-2" style={{ marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem', WebkitOverflowScrolling: 'touch' }}>
                <button 
                  onClick={() => setSelectedCategory('All')} 
                  style={{ 
                    padding: '0.5rem 1.25rem', borderRadius: '20px', border: '1px solid var(--panel-border)',
                    background: selectedCategory === 'All' ? 'var(--primary)' : 'rgba(255,255,255,0.03)', 
                    color: selectedCategory === 'All' ? 'white' : 'var(--text-muted)', 
                    cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500, transition: 'all 0.2s', backdropFilter: 'blur(10px)'
                  }}
                >
                  大盘总览 (All)
                </button>
                {categoryTabs.map(([cn, count]) => (
                  <button 
                    key={cn} 
                    onClick={() => setSelectedCategory(cn)} 
                    style={{ 
                      padding: '0.5rem 1.25rem', borderRadius: '20px', border: '1px solid var(--panel-border)',
                      background: selectedCategory === cn ? 'var(--primary)' : 'rgba(255,255,255,0.03)', 
                      color: selectedCategory === cn ? 'white' : 'var(--text-muted)', 
                      cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500, transition: 'all 0.2s', backdropFilter: 'blur(10px)'
                    }}
                  >
                    {cn} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{count}</span>
                  </button>
                ))}
              </div>

              {/* Bento Grid Stats */}
              <div className="bento-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="glass-panel bento-col-4" style={{ padding: '1.5rem' }}>
                  <div className="flex items-center gap-4">
                    <div style={{ background: 'rgba(96, 165, 250, 0.1)', padding: '1rem', borderRadius: '1rem' }}>
                      <Package color="var(--primary)" size={24} />
                    </div>
                    <div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>{selectedCategory !== 'All' ? '该品类收录数' : '总收录商品数'}</p>
                      <h2 style={{ fontSize: '2rem', margin: 0 }}>{dynamicStats?.total_products || 0}</h2>
                    </div>
                  </div>
                </div>
                
                <div className="glass-panel bento-col-4" style={{ padding: '1.5rem' }}>
                  <div className="flex items-center gap-4">
                    <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '1rem', borderRadius: '1rem' }}>
                      <TrendingUp color="var(--success)" size={24} />
                    </div>
                    <div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>有效在售/活跃</p>
                      <h2 style={{ fontSize: '2rem', margin: 0 }}>{dynamicStats?.active_products || 0}</h2>
                    </div>
                  </div>
                </div>

                <div className="glass-panel bento-col-4" style={{ padding: '1.5rem' }}>
                  <div className="flex items-center gap-4">
                    <div style={{ background: 'rgba(167, 139, 250, 0.1)', padding: '1rem', borderRadius: '1rem' }}>
                      <Activity color="#a78bfa" size={24} />
                    </div>
                    <div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>总销售热度 (预估)</p>
                      <h2 style={{ fontSize: '2rem', margin: 0 }}>{dynamicStats?.total_snapshots || 0}</h2>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Bento */}
              <div className="bento-grid">
                <div className="glass-panel bento-col-12" style={{ padding: '1.5rem' }}>
                  <h3 className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}><BarChart3 size={20} color="var(--primary)" /> {selectedCategory !== 'All' ? `【${selectedCategory}】` : ''}蓝海价格段分析 <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(柱条=商品数, 折线=总评论数)</span></h3>
                  <div style={{ height: '340px', width: '100%' }}>
                    {priceDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={priceDistribution} margin={{ top: 10, right: 20, left: 10, bottom: 45 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} angle={-40} textAnchor="end" height={55} interval={0} />
                          <YAxis yAxisId="left" stroke="#60a5fa" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} label={{ value: '商品数 (个)', angle: -90, position: 'insideLeft', style: { fill: '#60a5fa', fontSize: 11 } }} />
                          <YAxis yAxisId="right" orientation="right" stroke="#34d399" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} label={{ value: '总评论 (条)', angle: 90, position: 'insideRight', style: { fill: '#34d399', fontSize: 11 } }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar yAxisId="left" dataKey="productCount" name="商品数(竞争)" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={18} opacity={0.8} />
                          <Line yAxisId="right" type="monotone" dataKey="totalReviews" name="总评论(需求)" stroke="var(--success)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center" style={{ height: '100%', justifyContent: 'center', color: 'var(--text-muted)' }}>暂无分析数据</div>
                    )}
                  </div>
                </div>

              </div>

              {/* Charts Row 2: Scatter + Brand Ranking */}
              <div className="bento-grid" style={{ marginTop: '1.5rem' }}>
                <div className="glass-panel bento-col-6" style={{ padding: '1.5rem' }}>
                  <h3 className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}><Activity size={20} color="#f59e0b" /> {selectedCategory !== 'All' ? `【${selectedCategory}】` : ''}价格销量分布图 <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(气泡大小=评论数)</span></h3>
                  <div style={{ height: '320px', width: '100%' }}>
                    {scatterData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" dataKey="price" name="价格" unit=" AED" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => typeof v === 'number' && !Number.isInteger(v) ? Number(v).toFixed(2) : v} label={{ value: '价格 (AED)', position: 'insideBottom', offset: -12, style: { fill: '#a1a1aa', fontSize: 11 } }} />
                          <YAxis type="number" dataKey="sales" name="预估销量" unit=" 件" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => typeof v === 'number' && !Number.isInteger(v) ? Number(v).toFixed(2) : v} label={{ value: '预估销量 (件)', angle: -90, position: 'insideLeft', style: { fill: '#a1a1aa', fontSize: 11 } }} />
                          <ZAxis type="number" dataKey="reviews" range={[20, 280]} name="评论数" />
                          <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div style={{ background: 'rgba(15,17,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                                  <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{d.name}</p>
                                  <p style={{ color: '#f59e0b' }}>价格: {d.price} AED</p>
                                  <p style={{ color: '#34d399' }}>预估销量: {d.sales} 件</p>
                                  <p style={{ color: '#60a5fa' }}>评论数: {d.reviews}</p>
                                  <p style={{ color: '#a78bfa' }}>评分: {d.rating || '无'}</p>
                                </div>
                              );
                            }}
                          />
                          <Scatter name="商品" data={scatterData} fill="#f59e0b" fillOpacity={0.55} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center" style={{ height: '100%', justifyContent: 'center', color: 'var(--text-muted)' }}>暂无数据</div>
                    )}
                  </div>
                </div>

                <div className="glass-panel bento-col-6" style={{ padding: '1.5rem' }}>
                  <h3 className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}><BarChart3 size={20} color="#34d399" /> {selectedCategory !== 'All' ? `【${selectedCategory}】` : ''}品牌竞争力 TOP10 <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(按总评论数排名, 柱条=总评论, 标签=商品数)</span></h3>
                  <div style={{ height: '320px', width: '100%' }}>
                    {brandRanking.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={brandRanking} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                          <XAxis type="number" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => typeof v === 'number' && !Number.isInteger(v) ? Number(v).toFixed(2) : v} label={{ value: '总评论 (条)', position: 'insideBottom', offset: -5, style: { fill: '#a1a1aa', fontSize: 11 } }} />
                          <YAxis type="category" dataKey="name" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} width={100} />
                          <Tooltip
                            content={({ active, payload }: any) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div style={{ background: 'rgba(15,17,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                                  <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{d.name}</p>
                                  <p style={{ color: '#34d399' }}>总评论: {d.总评论}</p>
                                  <p style={{ color: '#60a5fa' }}>商品数: {d.商品数} 个</p>
                                  <p style={{ color: '#f59e0b' }}>平均评分: {d.均分 || '无'}</p>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="总评论" fill="url(#brandGradient)" radius={[0, 6, 6, 0]} barSize={18} />
                          <defs>
                            <linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#34d399" stopOpacity={0.4}/>
                              <stop offset="100%" stopColor="#34d399" stopOpacity={1}/>
                            </linearGradient>
                          </defs>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center" style={{ height: '100%', justifyContent: 'center', color: 'var(--text-muted)' }}>暂无品牌数据</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===================== SCRAPER TAB ===================== */}
          {activeTab === 'scraper' && (
            <motion.div key="scraper" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h1>付费搜查</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>在这里发起实时抓取任务，数据经过智能清洗后会自动进入大盘。</p>
              
              <div className="bento-grid">
                <div className="glass-panel bento-col-12" style={{ padding: '3rem', textAlign: 'center', background: 'rgba(25, 28, 41, 0.7)' }}>
                  <form onSubmit={handleScrape} className="flex gap-4" style={{ maxWidth: '100%', margin: '0 auto', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="输入竞速抓取关键词 (如 massage gun)..." 
                        style={{ paddingLeft: '3rem', paddingRight: '1rem', height: '54px', fontSize: '1.05rem', borderRadius: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={scraping || waitingForLog}
                      />
                    </div>
                    
                    <CustomSelect
                      value={scrapePages}
                      onChange={(val) => setScrapePages(Number(val))}
                      disabled={scraping || waitingForLog}
                      title="抓取数量（每批 200 件）"
                      style={{ width: '130px', borderRadius: '16px', height: '54px' }}
                      options={[
                        { label: '200 件', value: 1 },
                        { label: '600 件', value: 3 },
                        { label: '1000 件', value: 5 },
                        { label: '2000 件', value: 10 },
                      ]}
                    />

                    <CustomSelect
                      value={scrapeProvider}
                      onChange={(val) => setScrapeProvider(val as 'scraperapi' | 'oxylabs')}
                      disabled={scraping || waitingForLog}
                      title="选择付费抓取引擎：ScraperAPI / Oxylabs（本地直连请用左侧「本地直连」页面）"
                      style={{ width: '160px', borderRadius: '16px', height: '54px' }}
                      options={[
                        { label: 'ScraperAPI', value: 'scraperapi' },
                        { label: 'Oxylabs', value: 'oxylabs' },
                      ]}
                    />

                    <button type="submit" className="btn" disabled={scraping || waitingForLog} style={{ height: '54px', padding: '0 2rem', borderRadius: '16px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                      {(scraping || waitingForLog) ? <RefreshCw className="spin" size={20} /> : <><Play size={20} /> 执行抓取</>}
                      {waitingForLog && <span style={{marginLeft: '0.5rem'}}>引擎启动中...</span>}
                    </button>
                  </form>
                </div>

                <div className="glass-panel bento-col-12" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ marginBottom: '1.5rem' }}>当前任务状态</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <AnimatePresence>
                      {tasks.filter(t => !t.job_id?.startsWith('fetcher-') && t.status === 'RUNNING').map((task) => (
                        <motion.div 
                          key={task.job_id}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, margin: 0, padding: 0 }}
                          style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '1rem' }}>正在抓取: {task.query}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>请前往「系统日志」查看详细输出</span>
                          </div>
                          <div style={{ 
                            background: '#0a0c10', padding: '0.75rem', borderRadius: '8px', 
                            border: '1px solid #1f2937', marginBottom: '0.75rem',
                            fontFamily: '"Fira Code", Consolas, monospace', fontSize: '0.85rem', color: '#34d399',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>
                            {task.error_message ? `> ${task.error_message.split('\\n').filter(Boolean).pop()}` : '> 正在初始化爬虫引擎...'}
                          </div>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <motion.div
                              animate={{ width: ['0%', '100%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                              style={{ height: '100%', background: 'var(--primary)' }}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {tasks.filter(t => !t.job_id?.startsWith('fetcher-') && t.status === 'RUNNING').length === 0 && (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>暂无执行中的任务</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===================== FETCHER TAB (本地直连) ===================== */}
          {activeTab === 'fetcher' && (
            <motion.div key="fetcher" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h1>本地直搜</h1>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                🦊 基于 curl_cffi Firefox TLS 指纹模拟，直接绕过 Akamai Bot Manager，<strong>无需付费 API</strong>。数据经智能清洗后自动进入大盘。
              </p>

              <div className="bento-grid">
                <div className="glass-panel bento-col-12" style={{ padding: '3rem', textAlign: 'center', background: 'rgba(25, 28, 41, 0.7)' }}>
                  <form onSubmit={handleFetcherScrape} className="flex gap-4" style={{ maxWidth: '100%', margin: '0 auto', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="input"
                        placeholder="输入直连抓取关键词 (如 massage gun)..."
                        style={{ paddingLeft: '3rem', paddingRight: '1rem', height: '54px', fontSize: '1.05rem', borderRadius: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                        value={fetcherQuery}
                        onChange={(e) => setFetcherQuery(e.target.value)}
                        disabled={scraping || waitingForLog}
                      />
                    </div>

                    <CustomSelect
                      value={fetcherPages}
                      onChange={(val) => setFetcherPages(Number(val))}
                      disabled={scraping || waitingForLog}
                      title="抓取数量（每批 200 件）"
                      style={{ width: '130px', borderRadius: '16px', height: '54px' }}
                      options={[
                        { label: '200 件', value: 1 },
                        { label: '600 件', value: 3 },
                        { label: '1000 件', value: 5 },
                        { label: '2000 件', value: 10 },
                      ]}
                    />

                    <button type="submit" className="btn" disabled={scraping || waitingForLog} style={{ height: '54px', padding: '0 2rem', borderRadius: '16px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                      {(scraping || waitingForLog) ? <RefreshCw className="spin" size={20} /> : <><Zap size={20} /> 直连抓取</>}
                      {waitingForLog && <span style={{marginLeft: '0.5rem'}}>引擎启动中...</span>}
                    </button>
                  </form>
                </div>

                <div className="glass-panel bento-col-12" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ marginBottom: '1.5rem' }}>当前任务状态</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <AnimatePresence>
                      {tasks.filter(t => t.job_id?.startsWith('fetcher-') && t.status === 'RUNNING').map((task) => (
                        <motion.div
                          key={task.job_id}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, margin: 0, padding: 0 }}
                          style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem' }}>
                            <span style={{ fontWeight: 600, fontSize: '1rem' }}>正在抓取: {task.query}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>请前往「系统日志」查看详细输出</span>
                          </div>
                          <div style={{ 
                            background: '#0a0c10', padding: '0.75rem', borderRadius: '8px', 
                            border: '1px solid #1f2937', marginBottom: '0.75rem',
                            fontFamily: '"Fira Code", Consolas, monospace', fontSize: '0.85rem', color: '#f59e0b',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>
                            {task.error_message ? `> ${task.error_message.split('\\n').filter(Boolean).pop()}` : '> 正在初始化直连任务...'}
                          </div>
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                            <motion.div
                              animate={{ width: ['0%', '100%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                              style={{ height: '100%', background: '#f59e0b' }}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {tasks.filter(t => t.job_id?.startsWith('fetcher-') && t.status === 'RUNNING').length === 0 && (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>暂无执行中的直连任务</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===================== DATABASE TAB ===================== */}
          {activeTab === 'database' && (
            <motion.div
              key="database"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <h1>数据库 ({filteredProducts.length} 件)</h1>
                  <p style={{ color: 'var(--text-muted)' }}>已清洗入库的所有商品列表（点击可查看单品趋势）</p>
                </div>
              </div>
              
              {/* Category Horizontal Tabs & Batch Actions */}
              <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
                <div className="flex gap-2" style={{ overflowX: 'auto', paddingBottom: '0.5rem', WebkitOverflowScrolling: 'touch', flex: 1 }}>
                  <button 
                    onClick={() => setSelectedCategory('All')} 
                    style={{ 
                      padding: '0.5rem 1.25rem', borderRadius: '20px', border: '1px solid var(--panel-border)',
                      background: selectedCategory === 'All' ? 'var(--primary)' : 'rgba(255,255,255,0.03)', 
                      color: selectedCategory === 'All' ? 'white' : 'var(--text-muted)', 
                      cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500, transition: 'all 0.2s', backdropFilter: 'blur(10px)'
                    }}
                  >
                  全部 (All)
                </button>
                {categoryTabs.map(([cn, count]) => (
                  <button 
                    key={cn} 
                    onClick={() => setSelectedCategory(cn)} 
                    style={{ 
                      padding: '0.5rem 1.25rem', borderRadius: '20px', border: '1px solid var(--panel-border)',
                      background: selectedCategory === cn ? 'var(--primary)' : 'rgba(255,255,255,0.03)', 
                      color: selectedCategory === cn ? 'white' : 'var(--text-muted)', 
                      cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 500, transition: 'all 0.2s', backdropFilter: 'blur(10px)'
                    }}
                  >
                    {cn} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{count}</span>
                  </button>
                ))}
                </div>
                
              </div>
              
              <DatabaseTable 
                data={filteredProducts} 
                onRowClick={openPriceTrend} 
                onBatchDelete={handleBatchDeleteWithSkus} 
              />
            </motion.div>
          )}

          {/* ===================== ANALYSIS TAB ===================== */}
          {activeTab === 'analysis' && (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ReviewAnalysisPage initialSku={analysisSku} onExecutionUpdate={handleExecutionUpdate} />
            </motion.div>
          )}

          {/* ===================== LOGS TAB ===================== */}
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
      
      {/* Price Trend Modal Overlay */}
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
                        query: selectedSku, // Directly search SKU to refresh it
                        country: 'uae',
                        language: 'en',
                        provider: 'fetcher'
                      });
                      
                      const startTime = Date.now();
                      let attempts = 0;
                      
                      const intervalId = setInterval(async () => {
                        attempts++;
                        try {
                          const res = await api.get(`/products/${encodeURIComponent(selectedSku!)}/prices`);
                          const rawData = res.data;
                          // If there's new data scraped after our request started (buffer 10s just in case)
                          const hasNewData = rawData.some((item: any) => parseScrapedAt(item.scraped_at).getTime() > startTime - 10000);
                          
                          if (hasNewData || attempts >= 15) { // 45 seconds max
                            clearInterval(intervalId);
                            const dailyMap = new Map();
                            const sortedData = res.data.sort((a: any, b: any) => parseScrapedAt(a.scraped_at).getTime() - parseScrapedAt(b.scraped_at).getTime());
                            
                            sortedData.forEach((item: any) => {
                              const date = parseScrapedAt(item.scraped_at);
                              const yyyy = date.getFullYear();
                              const mm = String(date.getMonth() + 1).padStart(2, '0');
                              const dd = String(date.getDate()).padStart(2, '0');
                              
                              dailyMap.set(`${yyyy}-${mm}-${dd}`, {
                                time: `${yyyy}-${mm}-${dd}`,
                                price: item.price != null ? Number(Number(item.price).toFixed(2)) : item.price,
                                original_price: item.original_price != null ? Number(Number(item.original_price).toFixed(2)) : item.original_price,
                                review_count: item.review_count || 0
                              });
                            });
                            setPriceHistory(Array.from(dailyMap.values()));
                            setIsRefreshingSku(false);
                          }
                        } catch (err) {
                          console.error(err);
                          if (attempts >= 15) {
                            clearInterval(intervalId);
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
                      <YAxis yAxisId="left" stroke="#60a5fa" fontSize={12} tickLine={false} axisLine={false} domain={[(dataMin) => Math.max(0, dataMin - 20), 'dataMax + 20']} tickFormatter={(v) => typeof v === 'number' && !Number.isInteger(v) ? Number(v).toFixed(2) : v} />
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
