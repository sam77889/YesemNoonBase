import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'lucide-react';
import { motion } from 'framer-motion';

export type LogType = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: LogType;
}

export interface ExecutionBlock {
  id: string;
  title: string;
  source: 'analysis' | 'scraper' | 'fetcher';
  status: 'running' | 'success' | 'error';
  timestamp: Date;
  logs: LogEntry[];
  progress: number;
}

interface SystemLogsPageProps {
  blocks: ExecutionBlock[];
  onClear: () => void;
}

export function SystemLogsPage({ blocks, onClear }: SystemLogsPageProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (blocks.length > 0 && !expandedId) {
      setExpandedId(blocks[0].id);
    }
  }, [blocks]);

  const getLogColor = (type: LogType) => {
    switch (type) {
      case 'success': return '#60a5fa';
      case 'warning': return '#fbbf24';
      case 'error': return '#f87171';
      default: return '#34d399';
    }
  };



  const TerminalBlock = ({ block }: { block: ExecutionBlock }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, [block.logs]);

    return (
      <div 
        className="glass-panel" 
        style={{ 
          background: '#0a0c10', 
          border: '1px solid #1f2937', 
          borderTop: 'none',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          height: '400px'
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #1f2937' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f87171' }}></div>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fbbf24' }}></div>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#34d399' }}></div>
          <span style={{ marginLeft: '1rem', fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>bash - root@noon-dashboard:~</span>
        </div>
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
          {block.logs.length === 0 ? (
            <div style={{ color: '#6b7280', fontStyle: 'italic', padding: '1rem' }}>暂无日志记录...</div>
          ) : (
            <>
              {block.logs.map((log) => (
                <div 
                  key={log.id}
                  style={{ 
                    color: getLogColor(log.type),
                    lineHeight: '1.5',
                    wordBreak: 'break-all',
                    opacity: 0.95
                  }}
                >
                  {`> ${log.message}`}
                </div>
              ))}
              {block.status === 'running' && (
                <motion.div
                  animate={{ opacity: [1, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  style={{ width: '8px', height: '15px', background: '#34d399', marginTop: '0.25rem' }}
                />
              )}
            </>
          )}
        </div>
      </div>
    );
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
          <p style={{ color: 'var(--text-muted)' }}>按执行次数分组的全局操作日志</p>
        </div>
        <button 
          className="btn" 
          onClick={onClear}
          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '8px', background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.3)' }}
        >
          清除日志
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {blocks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>暂无执行记录</div>
        ) : (
          blocks.map(block => {
            const isExpanded = expandedId === block.id;
            return (
              <div key={block.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : block.id)}
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid #1f2937', borderRadius: isExpanded ? '12px 12px 0 0' : '12px',
                    cursor: 'pointer', transition: 'background 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{block.title}</span>
                    <span style={{ 
                      padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem',
                      background: block.status === 'success' ? 'rgba(52, 211, 153, 0.1)' : block.status === 'error' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(96, 165, 250, 0.1)',
                      color: block.status === 'success' ? '#34d399' : block.status === 'error' ? '#f87171' : '#60a5fa'
                    }}>
                      {block.status === 'running' ? `执行中 (${block.progress}%)` : block.status === 'success' ? '已完成' : '异常结束'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {block.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                {isExpanded && <TerminalBlock block={block} />}
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
