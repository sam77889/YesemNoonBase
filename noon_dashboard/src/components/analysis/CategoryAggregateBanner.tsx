import { BarChart3 } from 'lucide-react';
import type { CategoryAnalysisResponse } from '../../api';

export function CategoryAggregateBanner({ data }: { data: CategoryAnalysisResponse }) {
  return (
    <div
      style={{
        marginBottom: '1.5rem',
        padding: '0.75rem 1rem',
        borderRadius: '12px',
        background: 'rgba(96, 165, 250, 0.08)',
        border: '1px solid rgba(96, 165, 250, 0.2)',
        color: 'var(--text-main)',
        fontSize: '0.9rem',
      }}
    >
      <BarChart3 size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--primary)' }} />
      类目聚合：<strong>{data.category}</strong> · {data.product_count} 个商品 · {data.review_count} 条评论
    </div>
  );
}
