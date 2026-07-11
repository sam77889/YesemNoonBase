import { useState } from 'react';
import { useScrapeController } from '../hooks/useScrapeController';
import { useTasks } from '../hooks/useProducts';
import { Search, RefreshCw, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TaskCard } from '../components/TaskCard';

export function MobileScraperPage() {
  const sc = useScrapeController();
  const { data: tasks = [] } = useTasks();
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    await sc.triggerScrape(query, pages, 'fetcher');
    setQuery('');
  };

  const fetcherTasks = tasks.filter(t => t.job_id?.startsWith('fetcher-'));
  const latestFetcherTask = fetcherTasks[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2rem' }}>
      <div style={{ padding: '0 0.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>本地直搜</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
          🦊 基于 curl_cffi TLS 指纹模拟，直接绕过 Akamai，<strong>无需付费 API</strong>。
        </p>
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="input" 
              placeholder="输入直连抓取关键词..." 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              disabled={sc.scraping || sc.waitingForLog}
              style={{ height: '54px', paddingLeft: '2.75rem', paddingRight: '1rem', fontSize: '1rem', borderRadius: '12px' }} 
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>抓取数量:</span>
            <select 
              className="select" 
              value={pages} 
              onChange={(e) => setPages(Number(e.target.value))} 
              disabled={sc.scraping || sc.waitingForLog}
              style={{ flex: 1, height: '54px', padding: '0 1rem', borderRadius: '12px', fontSize: '0.95rem' }}
            >
              <option value={1}>200 件</option>
              <option value={3}>600 件</option>
              <option value={5}>1000 件</option>
              <option value={10}>2000 件</option>
            </select>
          </div>
          
          <button 
            type="submit" 
            className="btn" 
            disabled={sc.scraping || sc.waitingForLog || !query.trim()} 
            style={{ height: '54px', fontSize: '1rem', fontWeight: 600, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {(sc.scraping || sc.waitingForLog) ? <RefreshCw className="spin" size={20} /> : <Zap size={20} />}
            {(sc.scraping || sc.waitingForLog) ? (sc.waitingForLog ? '引擎启动中...' : '抓取中...') : '直连抓取'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>当前任务状态</h3>
        <AnimatePresence mode="popLayout">
          {latestFetcherTask ? (
            <TaskCard key={latestFetcherTask.job_id} task={latestFetcherTask} source="fetcher" />
          ) : (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              暂无任务记录
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
