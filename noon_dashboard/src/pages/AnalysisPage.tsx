import { MessageSquare, RefreshCw, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { CategoryAnalysisResponse } from '../api';
import { useReviewAnalysis, isCategoryAnalysis } from '../hooks/useReviewAnalysis';
import { AnalysisToolbar } from '../components/analysis/AnalysisToolbar';
import { StatusBanner } from '../components/analysis/StatusBanner';
import { AnalysisEmpty } from '../components/analysis/AnalysisPlaceholder';
import { OverviewCards } from '../components/analysis/OverviewCards';
import { CategoryAggregateBanner } from '../components/analysis/CategoryAggregateBanner';
import { AiSummaryCard } from '../components/analysis/AiSummaryCard';
import { AnalysisCharts } from '../components/analysis/AnalysisCharts';
import { ReviewsList } from '../components/analysis/ReviewsList';
import type { ExecutionUpdate } from '../types';

interface AnalysisPageProps {
  initialSku?: string;
  autoRun?: boolean;
  onAutoRunConsumed?: () => void;
  onExecutionUpdate?: (update: ExecutionUpdate) => void;
  categoryTabs?: [string, number][];
}

export function AnalysisPage({
  initialSku,
  autoRun,
  onAutoRunConsumed,
  onExecutionUpdate,
  categoryTabs,
}: AnalysisPageProps) {
  const {
    mode,
    setMode,
    skuInput,
    setSkuInput,
    selectedCategory,
    setSelectedCategory,
    data,
    loading,
    analyzeSku,
    refreshSku,
    analyzeCategory,
  } = useReviewAnalysis({ initialSku, autoRun, onAutoRunConsumed, onExecutionUpdate });

  const isCategoryData = isCategoryAnalysis(data ?? ({} as never));
  // 当前数据是否匹配当前模式（避免类目模式下显示单 SKU 报告，反之亦然）
  const dataMatchesMode = data ? (mode === 'category' ? isCategoryData : !isCategoryData) : false;

  const renderLoadingBanner = () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1rem',
        borderRadius: '12px',
        background: 'rgba(96, 165, 250, 0.1)',
        border: '1px solid rgba(96, 165, 250, 0.3)',
        color: 'var(--primary)',
        marginBottom: '1.5rem',
      }}
    >
      <Loader2 size={22} className="spin" />
      <span style={{ fontWeight: 500 }}>
        {mode === 'category' ? '类目聚合分析进行中，正在后台抓取评论...' : '深度分析进行中...'}
      </span>
    </div>
  );

  const renderContent = () => {
    // loading 且无旧数据：显示空状态 + 加载提示
    if (loading && !dataMatchesMode) {
      return (
        <div>
          {renderLoadingBanner()}
          <AnalysisEmpty />
        </div>
      );
    }
    if (!data || !dataMatchesMode) return <AnalysisEmpty />;

    const { status, reviews, analysis, count } = data;
    const summary = analysis.summary;

    return (
      <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
        {/* loading 时叠加显示进行中状态，不清空已有数据 */}
        {loading && renderLoadingBanner()}

        <div style={{ marginBottom: '1.5rem' }}>
          <StatusBanner data={data} />
        </div>

        {/* 商品基础信息（单品模式） */}
        {!isCategoryData && (data.product_name || data.product_image) && (
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            {data.product_image && (
              <img src={data.product_image} alt={data.product_name || "商品图片"} style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px', background: '#fff' }} />
            )}
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: 'var(--text-main)', lineHeight: 1.4 }}>{data.product_name || '未知商品'}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>SKU: {skuInput}</p>
            </div>
          </div>
        )}

        {isCategoryData && <CategoryAggregateBanner data={data as CategoryAnalysisResponse} />}

        {status === 'success' && count > 0 && summary && <AiSummaryCard summary={summary} />}

        {status === 'success' && count > 0 && <OverviewCards count={count} analysis={analysis} />}

        {status === 'success' && count > 0 && <AnalysisCharts analysis={analysis} />}

        {status === 'success' && reviews.length > 0 && <ReviewsList reviews={reviews} />}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{ paddingBottom: '2rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <MessageSquare size={28} style={{ color: 'var(--primary)' }} />
            深度分析
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            输入 SKU 或选择类目，获取 AI 评论分析、情感趋势与用户画像
          </p>
        </div>
        {/* 当有评论数据时，显示「重新抓取」按钮 */}
        {data && data.count > 0 && mode === 'sku' && skuInput && (
          <button
            type="button"
            className="btn"
            disabled={loading}
            onClick={() => void refreshSku(skuInput)}
            style={{
              height: '40px',
              padding: '0 1.25rem',
              borderRadius: '12px',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
            }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? '抓取中...' : '重新抓取最新'}
          </button>
        )}
      </div>

      <AnalysisToolbar
        mode={mode}
        onModeChange={setMode}
        loading={loading}
        skuInput={skuInput}
        onSkuInputChange={setSkuInput}
        onAnalyzeSku={() => void analyzeSku(skuInput)}
        categoryTabs={categoryTabs}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        onAnalyzeCategory={() => void analyzeCategory(selectedCategory)}
      />

      {renderContent()}
    </motion.div>
  );
}
