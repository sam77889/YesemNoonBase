import { useScrapeController } from '../hooks/useScrapeController';

export function MobileSystemLogsPage() {
  const sc = useScrapeController();

  const handleCopy = () => {
    const allText = sc.executionBlocks.flatMap(b => b.logs.map(l => l.message)).join('\n');
    navigator.clipboard.writeText(allText);
    alert('日志已复制到剪贴板！');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: 'calc(100dvh - 12rem)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>系统实时日志</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={handleCopy} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', minHeight: '32px' }}>复制</button>
          <button type="button" onClick={sc.clearExecutionBlocks} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', minHeight: '32px', color: '#ef4444' }}>清空</button>
        </div>
      </div>

      {/* 日志终端区域 */}
      <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {sc.executionBlocks.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>暂无日志信息...</div>
        ) : (
          sc.executionBlocks.flatMap(b => b.logs).map((log, idx) => (
            <div key={idx} style={{ color: log.type === 'error' ? '#ef4444' : log.type === 'info' ? '#3b82f6' : 'var(--text-main)' }}>
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
