import { Terminal, Shield, AlertCircle, CheckCircle2, Info } from 'lucide-react';
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
  const getLogColor = (type: LogType) => {
    switch (type) {
      case 'success': return '#34d399';
      case 'warning': return '#fbbf24';
      case 'error': return '#f87171';
      default: return '#60a5fa';
    }
  };

  const getLogIcon = (type: LogType) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={14} style={{ color: '#34d399' }} />;
      case 'warning': return <Shield size={14} style={{ color: '#fbbf24' }} />;
      case 'error': return <AlertCircle size={14} style={{ color: '#f87171' }} />;
      default: return <Info size={14} style={{ color: '#60a5fa' }} />;
    }
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
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #1f2937' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f87171' }}></div>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fbbf24' }}></div>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#34d399' }}></div>
          <span style={{ marginLeft: '1rem', fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>bash - root@noon-dashboard:~</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', fontFamily: '"Fira Code", Consolas, monospace', fontSize: '0.85rem' }}>
          {logs.length === 0 ? (
            <div style={{ color: '#6b7280', fontStyle: 'italic', padding: '1rem' }}>暂无日志记录...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {logs.map((log) => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', lineHeight: '1.5' }}>
                  <span style={{ color: '#6b7280', minWidth: '70px' }}>
                    [{log.timestamp.toLocaleTimeString('en-US', { hour12: false })}]
                  </span>
                  <div style={{ marginTop: '0.15rem' }}>
                    {getLogIcon(log.type)}
                  </div>
                  <span style={{ color: '#94a3b8', minWidth: '90px' }}>[{log.source}]</span>
                  <span style={{ color: getLogColor(log.type), wordBreak: 'break-all' }}>{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
