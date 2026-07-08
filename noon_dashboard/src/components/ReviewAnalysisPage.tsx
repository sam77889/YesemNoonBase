import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, AlertTriangle, Info, AlertCircle, CheckCircle2, MessageSquare, Star, ThumbsUp, ThumbsDown, Meh, Zap, Shield, FileText, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { api, startCategoryAnalysis, getCategoryAnalysis } from '../api';
import type { ReviewResponse, CategoryAnalysisResponse } from '../api';
import { CategoryTabs } from './CategoryTabs';

interface ReviewAnalysisPageProps {
  initialSku?: string;
  autoRun?: boolean;
  onAutoRunConsumed?: () => void;
  onExecutionUpdate?: (id: string, title: string, source: 'analysis', status: 'running'|'success'|'error', progress: number, logs: string[]) => void;
  categoryTabs?: [string, number][];
}

const SENTIMENT_COLORS = {
  positive: '#34d399',
  neutral: '#fbbf24',
  negative: '#f87171'
};

const RATING_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: string | number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'rgba(15, 17, 26, 0.9)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
        {label && <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#f8fafc' }}>{label}</p>}
        {payload.map((entry, index) => (
          <p key={index} style={{ margin: 0, color: entry.color, fontSize: '0.875rem' }}>
            {entry.name}: <span style={{ fontWeight: 600 }}>{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function ReviewAnalysisPage({ initialSku, autoRun, onAutoRunConsumed, onExecutionUpdate, categoryTabs }: ReviewAnalysisPageProps) {
  const [mode, setMode] = useState<'sku' | 'category'>('sku');
  const [skuInput, setSkuInput] = useState(initialSku || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryTabs?.[0]?.[0] || '');
  const [data, setData] = useState<ReviewResponse | CategoryAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingLogsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mode !== 'sku') return;
    if (initialSku) setSkuInput(initialSku);
    if (autoRun && initialSku) {
      handleAnalyze(initialSku);
      if (onAutoRunConsumed) onAutoRunConsumed();
    }
  }, [initialSku, autoRun]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (loadingLogsInterval.current) {
        clearInterval(loadingLogsInterval.current);
      }
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);

  const handleAnalyze = async (targetSku: string) => {
    if (!targetSku.trim()) return;
    setLoading(true);
    
    setData(null);
    
    const execId = `analysis-${Date.now()}`;
    const title = `深度分析 - SKU: ${targetSku}`;
    let currentLogs: string[] = [];
    let currentProgress = 0;
    
    const updateGlobal = (msg: string, isEnd = false, err = false) => {
      currentLogs.push(msg);
      if (isEnd) currentProgress = 100;
      else currentProgress = Math.min(95, currentProgress + 10);
      
      const status = isEnd ? (err ? 'error' : 'success') : 'running';
      if (onExecutionUpdate) {
        onExecutionUpdate(execId, title, 'analysis', status, currentProgress, [...currentLogs]);
      }
    };

    updateGlobal(`> 初始化针对 SKU [${targetSku}] 的深度分析任务...`);

    const logSequence = [
      `> 建立网络请求上下文...`,
      `> 分配请求到高匿轮询代理池...`,
      `> 尝试与 Noon 服务器建立连接...`,
      `> 注入浏览器特征指纹，规避 Akamai Bot Manager...`,
      `> 成功触达页面，解析目标商品详情 (SKU: ${targetSku})...`,
      `> 正在提取 JSON-LD 内嵌的 Review 数据集...`,
      `> 对评论文本进行 NLP 情感极性计算...`,
      `> 提取高频特征词，区分 Pros / Cons...`,
      `> 调用 deep-translator 引擎进行中文本地化...`,
      `> 正在生成多维度综合数据及 AI 智能摘要...`,
      `> 即将完成，正在渲染可视化图表...`
    ];

    let step = 0;
    loadingLogsInterval.current = setInterval(() => {
      if (step < logSequence.length) {
        updateGlobal(logSequence[step]);
        step++;
      }
    }, 600);

    try {
      const res = await api.get<ReviewResponse>(`/products/${encodeURIComponent(targetSku)}/reviews`);
      clearInterval(loadingLogsInterval.current);
      updateGlobal(`> 分析完成！成功获取并清洗全部数据。`, true, false);
      setData(res.data);
    } catch (err: any) {
      clearInterval(loadingLogsInterval.current);
      updateGlobal(`> [致命错误] 分析任务中断: ${err?.response?.data?.detail || err.message}`, true, true);
      console.error(err);
      setData({
        status: 'error',
        message: err?.response?.data?.detail || '获取评论失败，请检查网络或后端日志。',
        reviews: [],
        analysis: {
          rating_distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
          average_rating: 0,
          sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
          top_keywords: [],
          timeline: []
        },
        count: 0,
        intercepted: false
      });
    }
    setLoading(false);
  };

  const handleCategoryAnalyze = async (category: string) => {
    if (!category || category === 'All') return;
    setLoading(true);
    setData(null);

    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }

    const execId = `category-analysis-${Date.now()}`;
    const title = `深度分析 - 类目: ${category}`;
    let currentLogs: string[] = [];
    let currentProgress = 0;

    const updateGlobal = (msg: string, isEnd = false, err = false) => {
      currentLogs.push(msg);
      if (isEnd) currentProgress = 100;
      else currentProgress = Math.min(95, currentProgress + 10);
      const status = isEnd ? (err ? 'error' : 'success') : 'running';
      if (onExecutionUpdate) {
        onExecutionUpdate(execId, title, 'analysis', status, currentProgress, [...currentLogs]);
      }
    };

    updateGlobal(`> 初始化针对类目 [${category}] 的评论聚合分析任务...`);

    try {
      const startRes = await startCategoryAnalysis(category);
      const { job_id, total_products } = startRes.data;
      updateGlobal(`> 已创建后台任务 ${job_id}，覆盖 ${total_products} 个商品...`);

      pollInterval.current = setInterval(async () => {
        try {
          const taskRes = await api.get(`/tasks/${encodeURIComponent(job_id)}`);
          const task = taskRes.data;
          updateGlobal(`> 任务状态: ${task.status}...`);

          if (task.status === 'SUCCESS') {
            if (pollInterval.current) {
              clearInterval(pollInterval.current);
              pollInterval.current = null;
            }
            updateGlobal(`> 后台抓取完成，正在聚合分析...`);
            const analysisRes = await getCategoryAnalysis(category);
            updateGlobal(`> 分析完成！成功聚合类目评论数据。`, true, false);
            setData(analysisRes.data);
            setLoading(false);
          } else if (task.status === 'FAILED') {
            if (pollInterval.current) {
              clearInterval(pollInterval.current);
              pollInterval.current = null;
            }
            updateGlobal(`> [错误] 后台任务失败: ${task.error_message || '未知错误'}`, true, true);
            setData({
              status: 'error',
              message: task.error_message || '类目评论分析失败',
              reviews: [],
              analysis: {
                rating_distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
                average_rating: 0,
                sentiment_distribution: { positive: 0, neutral: 0, negative: 0 },
                top_keywords: [],
                timeline: []
              },
              count: 0,
              intercepted: false,
              category,
              product_count: 0,
              review_count: 0,
            } as CategoryAnalysisResponse);
            setLoading(false);
          }
        } catch (err: any) {
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
          }
          updateGlobal(`> [错误] 轮询任务状态失败: ${err?.response?.data?.detail || err.message}`, true, true);
          setLoading(false);
        }
      }, 5000);
    } catch (err: any) {
      updateGlobal(`> [错误] 启动类目分析失败: ${err?.response?.data?.detail || err.message}`, true, true);
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)' }}>
            <Loader2 size={24} className="spin" />
            <span style={{ fontWeight: 500 }}>深度分析进行中...</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
    <span style={{ color: 'var(--primary)' }}>分析任务执行中...</span>
    <span style={{ color: 'var(--text-muted)' }}>日志已重定向至系统日志面板</span>
  </div>
  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
    <motion.div
      initial={{ width: '0%' }}
      animate={{ width: '80%' }}
      transition={{ duration: 10, ease: 'linear' }}
      style={{ height: '100%', background: 'var(--primary)' }}
    />
  </div>
</div>
        </div>
      );
    }

    if (!data) {
      return (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <MessageSquare size={48} style={{ opacity: 0.2, margin: '0 auto 1rem auto' }} />
          <p>输入 SKU 或选择类目并点击开始分析，获取深度评论洞察</p>
        </div>
      );
    }

    const { status, message, reviews, analysis, count, intercepted } = data;
    const {
      rating_distribution, average_rating, sentiment_distribution,
      text_sentiment_distribution, top_keywords, pros_keywords, cons_keywords,
      timeline, sentiment_timeline, verified_ratio,
      avg_review_length, review_length_distribution, rating_reliability, summary
    } = analysis;

    const totalSentiment = sentiment_distribution.positive + sentiment_distribution.neutral + sentiment_distribution.negative || 1;
    const positiveRate = Math.round((sentiment_distribution.positive / totalSentiment) * 100);
    const negativeRate = Math.round((sentiment_distribution.negative / totalSentiment) * 100);

    const textTotal = text_sentiment_distribution
      ? text_sentiment_distribution.positive + text_sentiment_distribution.neutral + text_sentiment_distribution.negative || 1
      : 0;
    const textPositiveRate = text_sentiment_distribution
      ? Math.round((text_sentiment_distribution.positive / textTotal) * 100)
      : 0;

    const ratingChartData = Object.entries(rating_distribution).map(([rating, count]) => ({
      rating: `${rating}星`,
      count,
      fill: RATING_COLORS[parseInt(rating) - 1]
    }));

    const sentimentChartData = [
      { name: '好评', key: 'positive', value: sentiment_distribution.positive, color: SENTIMENT_COLORS.positive },
      { name: '中评', key: 'neutral', value: sentiment_distribution.neutral, color: SENTIMENT_COLORS.neutral },
      { name: '差评', key: 'negative', value: sentiment_distribution.negative, color: SENTIMENT_COLORS.negative },
    ];

    const textSentimentChartData = text_sentiment_distribution ? [
      { name: '好评', value: text_sentiment_distribution.positive, color: SENTIMENT_COLORS.positive },
      { name: '中评', value: text_sentiment_distribution.neutral, color: SENTIMENT_COLORS.neutral },
      { name: '差评', value: text_sentiment_distribution.negative, color: SENTIMENT_COLORS.negative },
    ] : [];

    const lengthChartData = review_length_distribution ? [
      { name: '短评(<50字)', value: review_length_distribution.short, color: '#94a3b8' },
      { name: '中评(50-200字)', value: review_length_distribution.medium, color: '#60a5fa' },
      { name: '长评(>200字)', value: review_length_distribution.long, color: '#a78bfa' },
    ] : [];

    const reliabilityScore = rating_reliability ?? 0;
    const reliabilityLabel = reliabilityScore >= 0.8 ? '高' : reliabilityScore >= 0.5 ? '中' : '低';
    const reliabilityColor = reliabilityScore >= 0.8 ? '#34d399' : reliabilityScore >= 0.5 ? '#fbbf24' : '#f87171';

    const renderStatusBanner = () => {
      if (intercepted || status === 'intercepted') {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRadius: '12px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', color: '#fbbf24' }}>
            <AlertTriangle size={22} />
            <div>
              <strong>被 Akamai Bot Manager 拦截（508）</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>{message} 建议稍后重试或升级代理网络。</p>
            </div>
          </div>
        );
      }
      if (status === 'empty') {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRadius: '12px', background: 'rgba(148, 163, 184, 0.1)', border: '1px solid rgba(148, 163, 184, 0.3)', color: '#94a3b8' }}>
            <Info size={22} />
            <div>
              <strong>暂无评论</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>{message}</p>
            </div>
          </div>
        );
      }
      if (status === 'error') {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRadius: '12px', background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)', color: '#f87171' }}>
            <AlertCircle size={22} />
            <div>
              <strong>抓取失败</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>{message}</p>
            </div>
          </div>
        );
      }
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRadius: '12px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#34d399' }}>
          <CheckCircle2 size={22} />
          <div>
            <strong>抓取成功</strong>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>{message}</p>
          </div>
        </div>
      );
    };

    return (
      <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          {renderStatusBanner()}
        </div>

        {/* Category Aggregate Info */}
        {'category' in data && (
          <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', borderRadius: '12px', background: 'rgba(96, 165, 250, 0.08)', border: '1px solid rgba(96, 165, 250, 0.2)', color: 'var(--text-main)', fontSize: '0.9rem' }}>
            <BarChart3 size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--primary)' }} />
            类目聚合：<strong>{data.category}</strong> · {data.product_count} 个商品 · {data.review_count} 条评论
          </div>
        )}

        {/* AI Summary */}
        {status === 'success' && count > 0 && summary && (
          <div style={{ marginBottom: '1.5rem', padding: '1.25rem', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.08), rgba(167, 139, 250, 0.08))', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Zap size={18} style={{ color: 'var(--primary)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>AI 智能摘要</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-main)' }}>{summary}</p>
          </div>
        )}

        {/* Overview Cards */}
        {status === 'success' && count > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)' }}>{count}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>评论总数</div>
            </div>
            <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <Star size={18} /> {average_rating.toFixed(1)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>平均评分</div>
            </div>
            <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <ThumbsUp size={18} /> {positiveRate}%
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>评分好评率</div>
            </div>
            {text_sentiment_distribution && (
              <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <FileText size={18} /> {textPositiveRate}%
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>文本好评率</div>
              </div>
            )}
            <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <ThumbsDown size={18} /> {negativeRate}%
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>差评率</div>
            </div>
            {verified_ratio !== undefined && verified_ratio !== null && (
              <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <CheckCircle2 size={18} /> {Math.round(verified_ratio * 100)}%
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verified</div>
              </div>
            )}
            {rating_reliability !== undefined && rating_reliability !== null && (
              <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: reliabilityColor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <Shield size={18} /> {reliabilityLabel}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>评分可靠性</div>
              </div>
            )}
            {avg_review_length !== undefined && avg_review_length !== null && (
              <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#a78bfa' }}>
                  {avg_review_length}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>平均字数</div>
              </div>
            )}
          </div>
        )}

        {/* Charts Row 1: Rating + Sentiment */}
        {status === 'success' && count > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Rating Distribution */}
            <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>评分分布</h3>
              <div style={{ width: '100%', height: '220px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ratingChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis dataKey="rating" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="评论数" radius={[4, 4, 0, 0]}>
                      {ratingChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sentiment Comparison: Rating vs Text */}
            <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>
                情感分布
                {text_sentiment_distribution && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    (内环=评分 / 外环=文本)
                  </span>
                )}
              </h3>
              <div style={{ width: '100%', height: '220px', position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    {text_sentiment_distribution && (
                      <Pie
                        data={textSentimentChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                      >
                        {textSentimentChartData.map((entry, index) => (
                          <Cell key={`text-cell-${index}`} fill={entry.color} opacity={0.6} />
                        ))}
                      </Pie>
                    )}
                    <Pie
                      data={sentimentChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={text_sentiment_distribution ? 30 : 50}
                      outerRadius={text_sentiment_distribution ? 58 : 80}
                      paddingAngle={3}
                    >
                      {sentimentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={24} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Pros & Cons Keywords */}
        {status === 'success' && count > 0 && ((pros_keywords && pros_keywords.length > 0) || (cons_keywords && cons_keywords.length > 0)) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Pros */}
            <div style={{ background: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} style={{ color: '#34d399' }} />
                优点关键词
              </h3>
              {pros_keywords && pros_keywords.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {pros_keywords.map((kw: any, idx: number) => {
                    const maxCount = pros_keywords[0]?.count || 1;
                    const pct = Math.round((kw.count / maxCount) * 100);
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ minWidth: '80px', fontSize: '0.85rem', fontWeight: 500, color: '#34d399' }}>{kw.word}</span>
                        <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #34d399, #6ee7b7)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '30px', textAlign: 'right' }}>{kw.count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>暂无优点关键词</p>
              )}
            </div>

            {/* Cons */}
            <div style={{ background: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingDown size={18} style={{ color: '#f87171' }} />
                缺点关键词
              </h3>
              {cons_keywords && cons_keywords.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {cons_keywords.map((kw: any, idx: number) => {
                    const maxCount = cons_keywords[0]?.count || 1;
                    const pct = Math.round((kw.count / maxCount) * 100);
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ minWidth: '80px', fontSize: '0.85rem', fontWeight: 500, color: '#f87171' }}>{kw.word}</span>
                        <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #f87171, #fca5a5)', borderRadius: '4px', transition: 'width 0.5s ease' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '30px', textAlign: 'right' }}>{kw.count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>暂无缺点关键词</p>
              )}
            </div>
          </div>
        )}

        {/* Sentiment Timeline */}
        {status === 'success' && count > 0 && sentiment_timeline && sentiment_timeline.length > 1 && (
          <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>情感时间趋势</h3>
            <div style={{ width: '100%', height: '240px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sentiment_timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="date" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="positive" name="好评" stackId="1" stroke="#34d399" fill="rgba(52, 211, 153, 0.3)" />
                  <Area type="monotone" dataKey="neutral" name="中评" stackId="1" stroke="#fbbf24" fill="rgba(251, 191, 36, 0.3)" />
                  <Area type="monotone" dataKey="negative" name="差评" stackId="1" stroke="#f87171" fill="rgba(248, 113, 113, 0.3)" />
                  <Legend verticalAlign="top" height={24} iconType="circle" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Review Count Timeline (fallback if no sentiment_timeline) */}
        {status === 'success' && count > 0 && timeline.length > 0 && (!sentiment_timeline || sentiment_timeline.length <= 1) && (
          <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>评论时间趋势</h3>
            <div style={{ width: '100%', height: '220px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                  <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="count" name="评论数" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3, fill: 'var(--primary)' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Review Quality Section */}
        {status === 'success' && count > 0 && (review_length_distribution || rating_reliability !== undefined) && (
          <div style={{ display: 'grid', gridTemplateColumns: review_length_distribution ? '1fr 1fr' : '1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            {/* Review Length Distribution */}
            {review_length_distribution && (
              <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} style={{ color: '#a78bfa' }} />
                  评论长度分布
                </h3>
                <div style={{ width: '100%', height: '200px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lengthChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="name" stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name="评论数" radius={[4, 4, 0, 0]}>
                        {lengthChartData.map((entry, index) => (
                          <Cell key={`len-cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Rating Reliability */}
            {rating_reliability !== undefined && rating_reliability !== null && (
              <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={18} style={{ color: reliabilityColor }} />
                  评分可靠性分析
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                  <div style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    border: `6px solid ${reliabilityColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${reliabilityColor}11`,
                    boxShadow: `0 0 30px ${reliabilityColor}33`
                  }}>
                    <span style={{ fontSize: '2rem', fontWeight: 700, color: reliabilityColor }}>
                      {Math.round(reliabilityScore * 100)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>分</span>
                  </div>
                  <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '240px' }}>
                    {reliabilityScore >= 0.8
                      ? '评分与文本情感高度一致，评分参考价值高'
                      : reliabilityScore >= 0.5
                        ? '部分评论评分与文字情感不一致，需综合判断'
                        : '评分与文字情感矛盾较多，建议重点关注文字内容'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Keywords */}
        {status === 'success' && count > 0 && top_keywords.length > 0 && (
          <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} style={{ color: 'var(--primary)' }} />
              高频关键词 TOP15
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {top_keywords.map((kw: any, idx: number) => (
                <span
                  key={idx}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '20px',
                    background: idx < 3 ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${idx < 3 ? 'rgba(124, 58, 237, 0.5)' : 'var(--border-color)'}`,
                    fontSize: '0.85rem',
                    color: idx < 3 ? '#c4b5fd' : 'var(--text-main)'
                  }}
                >
                  {kw.word} <span style={{ opacity: 0.6, marginLeft: '0.25rem' }}>{kw.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Reviews */}
        {status === 'success' && reviews.length > 0 && (
          <div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>近期评论 ({reviews.length} 条)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {reviews.map((r: any, idx: number) => (
                <div key={idx} style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent-glow)' }}>
                        {'★'.repeat(r.rating || 0)}{'☆'.repeat(5 - (r.rating || 0))}
                      </span>
                      {r.verified && (
                        <span style={{ fontSize: '0.7rem', color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
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
                    <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
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
        )}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <MessageSquare size={28} style={{ color: 'var(--primary)' }} />
            深度分析
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>输入 SKU 或选择类目，获取 AI 评论分析、情感趋势与用户画像</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setMode('sku')}
            disabled={loading}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '12px', border: '1px solid var(--panel-border)',
              background: mode === 'sku' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
              color: mode === 'sku' ? 'white' : 'var(--text-muted)',
              cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500, transition: 'all 0.2s'
            }}
          >
            单品 SKU
          </button>
          <button
            type="button"
            onClick={() => setMode('category')}
            disabled={loading}
            style={{
              padding: '0.5rem 1.25rem', borderRadius: '12px', border: '1px solid var(--panel-border)',
              background: mode === 'category' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
              color: mode === 'category' ? 'white' : 'var(--text-muted)',
              cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500, transition: 'all 0.2s'
            }}
          >
            类目聚合
          </button>
        </div>

        {mode === 'sku' ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleAnalyze(skuInput); }}
            style={{ display: 'flex', gap: '1rem', maxWidth: '800px' }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input"
                placeholder="输入 SKU (如 N12345678A)..."
                style={{ paddingLeft: '3rem', paddingRight: '1rem', height: '54px', fontSize: '1.05rem', borderRadius: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                value={skuInput}
                onChange={(e) => setSkuInput(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="btn"
              disabled={loading || !skuInput.trim()}
              style={{ height: '54px', padding: '0 2rem', borderRadius: '16px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}
            >
              {loading ? <Loader2 size={20} className="spin" /> : '开始分析'}
            </button>
          </form>
        ) : (
          <div>
            <CategoryTabs
              tabs={categoryTabs || []}
              selected={selectedCategory}
              onChange={(c) => setSelectedCategory(c === 'All' ? '' : c)}
            />
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                className="btn"
                disabled={loading || !selectedCategory}
                onClick={() => handleCategoryAnalyze(selectedCategory)}
                style={{ height: '46px', padding: '0 1.5rem', borderRadius: '16px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}
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

      {renderContent()}

    </motion.div>
  );
}
