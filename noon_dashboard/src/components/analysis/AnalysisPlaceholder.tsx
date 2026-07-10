import { Loader2, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export function AnalysisLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)' }}>
        <Loader2 size={24} className="spin" />
        <span style={{ fontWeight: 500 }}>深度分析进行中...</span>
      </div>
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--primary)' }}>分析任务执行中...</span>
          <span style={{ color: 'var(--text-muted)' }}>实时日志见「系统日志」标签页</span>
        </div>
        <div
          style={{
            width: '100%',
            height: '4px',
            background: 'var(--surface-3)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '80%' }}
            transition={{ duration: 10, ease: 'linear' }}
            style={{ height: '100%', background: 'var(--primary)' }}
          />
        </div>
      </div>
    </div>
  );
}

export function AnalysisEmpty() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
      <MessageSquare size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
      <p>输入 SKU 或选择类目并点击开始分析，获取深度评论洞察</p>
    </div>
  );
}
