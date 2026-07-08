import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { motion } from 'framer-motion';

export type LogType = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  source: string;
  message: string;
  type: LogType;
}

interface SystemLogsPageProps {
  logs: LogEntry[];
  onClear: () => void;
}

export function SystemLogsPage({ logs, onClear }: SystemLogsPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: LogType) => {
    switch (type) {
      case 'success': return '#60a5fa'; // 蓝色代表任务完成
      case 'warning': return '#fbbf24'; // 黄色警告
      case 'error': return '#f87171';   // 红色错误
      default: return '#34d399';        // 默认极客绿
    }
  };

  const getLogOpacity = (index: number, total: number) => {
    const diff = total - 1 - index;
    if (diff === 0) return 1;
    if (diff <= 2) return 0.85;
    if (diff <= 5) return 0.6;
    if (diff <= 10) return 0.4;
    return 0.25;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{ paddingBottom: '2rem', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <Terminal size={28} style={{ color: 'var(--primary)' }} />
            系统日志
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>全局操作追踪与调试信息监控面板</p>
        </div>
        <button 
          className="btn" 
          onClick={onClear}
          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '8px', background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)' }}
        >
          清除日志
        </button>
      </div>

      <div 
        className="glass-panel" 
        style={{ 
          flex: 1, 
          background: '#0a0c10', 
          border: '1px solid #1f2937', 
          borderRadius: '12px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}
      >
        {/* Terminal Header */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #1f2937' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f87171' }}></div>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fbbf24' }}></div>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#34d399' }}></div>
          <span style={{ marginLeft: '1rem', fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>bash - root@noon-dashboard:~</span>
        </div>

        {/* Terminal Logs */}
        <div 
          ref={containerRef}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            fontFamily: '"Fira Code", Consolas, monospace', 
            fontSize: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            paddingRight: '1rem'
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: '#6b7280', fontStyle: 'italic', padding: '1rem' }}>暂无日志记录...</div>
          ) : (
            <>
              {logs.map((log, i) => (
                <motion.div 
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: getLogOpacity(i, logs.length), x: 0 }}
                  style={{ 
                    color: getLogColor(log.type),
                    lineHeight: '1.5',
                    wordBreak: 'break-all'
                  }}
                >
                  {`> ${log.message}`}
                </motion.div>
              ))}
              <motion.div
                animate={{ opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                style={{ width: '8px', height: '15px', background: '#34d399', marginTop: '0.25rem' }}
              />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
