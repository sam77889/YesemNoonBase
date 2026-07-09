import { Search, RefreshCw, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect } from '../components/CustomSelect';
import { TaskCard } from '../components/TaskCard';
import type { Task } from '../api';

interface ScraperPageProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  scrapePages: number;
  onScrapePagesChange: (pages: number) => void;
  scrapeProvider: 'scraperapi' | 'oxylabs';
  onScrapeProviderChange: (provider: 'scraperapi' | 'oxylabs') => void;
  scraping: boolean;
  waitingForLog: boolean;
  onSubmit: (e: React.FormEvent) => void;
  tasks: Task[];
}

export function ScraperPage({
  searchQuery, onSearchQueryChange,
  scrapePages, onScrapePagesChange,
  scrapeProvider, onScrapeProviderChange,
  scraping, waitingForLog, onSubmit,
  tasks
}: ScraperPageProps) {
  const scraperTasks = tasks.filter(t => !t.job_id?.startsWith('fetcher-') && !t.job_id?.startsWith('catrev-'));
  const latestScraperTask = scraperTasks[0];

  return (
    <motion.div key="scraper" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <h1>付费搜查</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>在这里发起实时抓取任务，数据经过智能清洗后会自动进入大盘。</p>

      <div className="bento-grid">
        <div className="glass-panel bento-col-12" style={{ padding: '3rem', textAlign: 'center', background: 'rgba(25, 28, 41, 0.7)' }}>
          <form onSubmit={onSubmit} className="flex gap-4" style={{ maxWidth: '100%', margin: '0 auto', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input"
                placeholder="输入竞速抓取关键词 (如 massage gun)..."
                style={{ paddingLeft: '3rem', paddingRight: '1rem', height: '54px', fontSize: '1.05rem', borderRadius: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                disabled={scraping || waitingForLog}
              />
            </div>
            <CustomSelect
              value={scrapePages}
              onChange={(val) => onScrapePagesChange(Number(val))}
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
              onChange={(val) => onScrapeProviderChange(val as 'scraperapi' | 'oxylabs')}
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
            <AnimatePresence mode="popLayout">
              {latestScraperTask ? (
                <TaskCard key={latestScraperTask.job_id} task={latestScraperTask} source="scraper" />
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>暂无任务记录</motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
