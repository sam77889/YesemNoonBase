import { Search, Loader2 } from 'lucide-react';
import { CategoryTabs } from '../CategoryTabs';
import { tabBtnStyle } from '../../lib/styles';
import type { AnalysisMode } from '../../types';

export type { AnalysisMode };

interface AnalysisToolbarProps {
  mode: AnalysisMode;
  onModeChange: (m: AnalysisMode) => void;
  loading: boolean;
  // SKU mode
  skuInput: string;
  onSkuInputChange: (s: string) => void;
  onAnalyzeSku: () => void;
  // Category mode
  categoryTabs?: [string, number][];
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  onAnalyzeCategory: () => void;
  // 分离页面后隐藏模式切换（页面已固定模式）
  showModeSwitch?: boolean;
}

export function AnalysisToolbar({
  mode,
  onModeChange,
  loading,
  skuInput,
  onSkuInputChange,
  onAnalyzeSku,
  categoryTabs,
  selectedCategory,
  onCategoryChange,
  onAnalyzeCategory,
  showModeSwitch = true,
}: AnalysisToolbarProps) {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      {showModeSwitch && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button type="button" onClick={() => onModeChange('sku')} disabled={loading} style={tabBtnStyle(mode === 'sku', loading)}>
            单品 SKU
          </button>
          <button type="button" onClick={() => onModeChange('category')} disabled={loading} style={tabBtnStyle(mode === 'category', loading)}>
            类目聚合
          </button>
        </div>
      )}

      {mode === 'sku' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAnalyzeSku();
          }}
          style={{ display: 'flex', gap: '1rem', maxWidth: '800px' }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={20}
              style={{
                position: 'absolute',
                left: '1.25rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="输入 SKU (如 N12345678A)..."
              style={{
                paddingLeft: '3rem',
                paddingRight: '1rem',
                height: '54px',
                fontSize: '1.05rem',
                borderRadius: '16px',
                background: 'var(--surface-2)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              value={skuInput}
              onChange={(e) => onSkuInputChange(e.target.value)}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn"
            disabled={loading || !skuInput.trim()}
            style={{
              height: '54px',
              padding: '0 2rem',
              borderRadius: '16px',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {loading ? <Loader2 size={20} className="spin" /> : '开始分析'}
          </button>
        </form>
      ) : (
        <div>
          <CategoryTabs
            tabs={categoryTabs || []}
            selected={selectedCategory}
            onChange={(c) => onCategoryChange(c === 'All' ? '' : c)}
          />
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="button"
              className="btn"
              disabled={loading || !selectedCategory}
              onClick={onAnalyzeCategory}
              style={{
                minHeight: '48px',
                padding: '0 1.5rem',
                borderRadius: '16px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {loading ? <Loader2 size={18} className="spin" /> : '开始品类分析'}
            </button>
            {!selectedCategory && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>请选择一个具体类目</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
