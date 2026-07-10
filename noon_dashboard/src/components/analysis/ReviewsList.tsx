import { Meh } from 'lucide-react';
import type { Review } from '../../api';

export function ReviewsList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null;
  return (
    <div>
      <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>近期评论 ({reviews.length} 条)</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {reviews.map((r, idx) => (
          <div
            key={idx}
            style={{
              background: 'var(--card-bg)',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--accent-glow)' }}>
                  {'★'.repeat(r.rating || 0)}
                  {'☆'.repeat(5 - (r.rating || 0))}
                </span>
                {r.verified && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: '#34d399',
                      background: 'rgba(52, 211, 153, 0.1)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                    }}
                  >
                    Verified
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {r.created_at ? new Date(r.created_at * 1000).toLocaleString() : ''}
              </span>
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>{r.title}</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{r.body}</p>
            {(r.author || r.helpful_count !== undefined) && (
              <div
                style={{
                  marginTop: '0.75rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  gap: '1rem',
                }}
              >
                {r.author && <span>By {r.author}</span>}
                {r.helpful_count !== undefined && r.helpful_count > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Meh size={14} /> Helpful {r.helpful_count}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
