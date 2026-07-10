import { AlertTriangle, Info, AlertCircle, CheckCircle2, Star, Database } from 'lucide-react';
import type { ReviewResponse } from '../../api';
import { bannerStyle } from '../../lib/styles';
import { formatDateTime } from '../../lib/utils';

export function StatusBanner({ data }: { data: ReviewResponse }) {
  const { status, message, intercepted, aggregate_rating, product_name, from_cache, cached_at } = data;

  if (intercepted || status === 'intercepted') {
    return (
      <div style={bannerStyle('rgba(251, 191, 36, 0.1)', 'rgba(251, 191, 36, 0.3)', '#fbbf24')}>
        <AlertTriangle size={22} />
        <div>
          <strong>被 Akamai Bot Manager 拦截（508）</strong>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>
            {message} 建议稍后重试或升级代理网络。
          </p>
        </div>
      </div>
    );
  }
  if (status === 'empty') {
    return (
      <div>
        <div style={bannerStyle('rgba(148, 163, 184, 0.1)', 'rgba(148, 163, 184, 0.3)', '#94a3b8')}>
          <Info size={22} />
          <div style={{ flex: 1 }}>
            <strong>暂无评论正文</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>{message}</p>
          </div>
        </div>
        {/* 若有 aggregateRating，展示评分概览 */}
        {aggregate_rating?.ratingValue != null && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <Star size={18} /> {Number(aggregate_rating.ratingValue).toFixed(1)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>综合评分{aggregate_rating.bestRating ? ` / ${aggregate_rating.bestRating}` : ''}</div>
            </div>
            {aggregate_rating.reviewCount != null && (
              <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>{aggregate_rating.reviewCount}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>评价总数</div>
              </div>
            )}
            {product_name && (
              <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center', gridColumn: 'span 2' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)', lineHeight: 1.4 }}>{product_name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>商品名称</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div style={bannerStyle('rgba(248, 113, 113, 0.1)', 'rgba(248, 113, 113, 0.3)', '#f87171')}>
        <AlertCircle size={22} />
        <div>
          <strong>抓取失败</strong>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>{message}</p>
        </div>
      </div>
    );
  }
  return (
    <div style={bannerStyle('rgba(52, 211, 153, 0.1)', 'rgba(52, 211, 153, 0.3)', '#34d399')}>
      {from_cache ? <Database size={22} /> : <CheckCircle2 size={22} />}
      <div>
        <strong>{from_cache ? '本地缓存数据' : '抓取成功'}</strong>
        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>{message}</p>
        {from_cache && cached_at && (
          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', opacity: 0.7 }}>
            缓存时间：{new Date(formatDateTime(cached_at)).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
