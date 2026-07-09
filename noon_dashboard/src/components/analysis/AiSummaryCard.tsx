import { Zap } from 'lucide-react';

export function AiSummaryCard({ summary }: { summary: string }) {
  return (
    <div
      style={{
        marginBottom: '1.5rem',
        padding: '1.25rem',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.08), rgba(167, 139, 250, 0.08))',
        border: '1px solid rgba(96, 165, 250, 0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Zap size={18} style={{ color: 'var(--primary)' }} />
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>AI 智能摘要</span>
      </div>
      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>{summary}</p>
    </div>
  );
}
