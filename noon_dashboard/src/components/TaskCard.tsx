import { motion } from 'framer-motion';
import type { Task } from '../api';

interface TaskCardProps {
  task: Task;
  source: 'fetcher' | 'scraper';
}

export function TaskCard({ task, source }: TaskCardProps) {
  const lastLog = task.error_message?.split('\n').filter(Boolean).pop();
  const accentColor = source === 'fetcher' ? '#f59e0b' : 'var(--primary)';

  return (
    <motion.div
      key={task.job_id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, margin: 0, padding: 0 }}
      style={{ background: 'rgba(0,0,0,0.3)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex justify-between items-center" style={{ marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>
          {task.status === 'SUCCESS' ? '✅ 任务完成: ' : task.status === 'FAILED' ? '❌ 任务失败: ' : '正在抓取: '}
          {task.query}
        </span>
        <span style={{ fontSize: '0.8rem', color: accentColor }}>请前往「系统日志」查看详细输出</span>
      </div>
      <div style={{
        background: '#0a0c10', padding: '0.75rem', borderRadius: '8px',
        border: '1px solid #1f2937', marginBottom: '0.75rem',
        fontFamily: '"Fira Code", Consolas, monospace', fontSize: '0.85rem', color: accentColor,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
      }}>
        {lastLog ? `> ${lastLog}` : `> 正在初始化${source === 'fetcher' ? '直连任务' : '爬虫引擎'}...`}
      </div>
      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
        {task.status === 'SUCCESS' ? (
          <div style={{ height: '100%', width: '100%', background: '#10b981' }} />
        ) : task.status === 'FAILED' ? (
          <div style={{ height: '100%', width: '100%', background: '#ef4444' }} />
        ) : (
          <motion.div
            animate={{ width: ['0%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            style={{ height: '100%', background: accentColor }}
          />
        )}
      </div>
    </motion.div>
  );
}
