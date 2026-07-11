import { useState } from 'react';
import { useScrapeController } from '../hooks/useScrapeController';
import { useTasks } from '../hooks/useProducts';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 表单卡片 */}
      <div className="card" style={{ padding: '1rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>快速提交采集任务</div>
          <input type="text" className="input" placeholder="输入搜索关键词" value={query} onChange={(e) => setQuery(e.target.value)} style={{ height: '48px', padding: '0 0.75rem', fontSize: '0.9rem' }} />
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>页数:</span>
            <select className="select" value={pages} onChange={(e) => setPages(Number(e.target.value))} style={{ flex: 1, height: '48px', padding: '0 0.75rem' }}>
              <option value={1}>1 页</option>
              <option value={2}>2 页</option>
              <option value={3}>3 页</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={sc.scraping} style={{ height: '48px', fontSize: '0.95rem', fontWeight: 600 }}>
            {sc.scraping ? '爬取中...' : '开始爬取'}
          </button>
        </form>
      </div>

      {/* 任务折叠列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', paddingLeft: '0.25rem' }}>历史任务列表</div>
        {tasks.slice(0, 5).map((task) => (
          <div key={task.job_id} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{task.query}</span>
              <span className={`status-pill ${task.status}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                {task.status === 'running' ? '运行中' : task.status === 'completed' ? '已完成' : '失败'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span>类型: {task.task_type}</span>
              <span>创建时间: {new Date(task.created_at || '').toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
