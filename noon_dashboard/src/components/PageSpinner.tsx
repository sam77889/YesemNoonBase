import { Activity } from 'lucide-react';

/**
 * 路由级 lazy 分包的 Suspense fallback。
 * 轻量 spinner，避免切换 tab 时白屏闪烁。
 */
export function PageSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: '1rem',
        color: 'var(--text-muted)',
      }}
    >
      <Activity size={36} className="spin" color="var(--primary)" aria-hidden="true" />
      <span style={{ fontSize: '0.9rem' }}>加载中…</span>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}
