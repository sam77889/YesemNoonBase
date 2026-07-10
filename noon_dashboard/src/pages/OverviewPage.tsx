import { useState, useEffect, useMemo } from 'react';
import { Search, Package, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { CategoryTabs } from '../components/CategoryTabs';
import { ChartTooltip } from '../components/analysis/ChartTooltip';
import { formatNumber } from '../lib/utils';
import { useOverviewAggregation } from '../hooks/useOverviewAggregation';

interface OverviewPageProps {
  filterText: string;
  onFilterTextChange: (text: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categoryTabs: [string, number][];
  overviewParams: { category?: string; q?: string };
}

interface ScatterDatum {
  name: string;
  price: number | null;
  sales: number;
  reviews: number;
  rating: number;
}

interface BrandRankDatum {
  name: string;
  商品数: number;
  总评论: number;
  均分: number;
}

export function OverviewPage({
  filterText, onFilterTextChange,
  selectedCategory, onCategoryChange, categoryTabs, overviewParams
}: OverviewPageProps) {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('overview_recent_searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      const txt = filterText.trim();
      if (!txt) return;
      
      if (/^N[a-zA-Z0-9]{6,}$/i.test(txt)) return;

      setRecentSearches(prev => {
        const filtered = prev.filter(k => k !== txt);
        const next = [txt, ...filtered].slice(0, 5);
        localStorage.setItem('overview_recent_searches', JSON.stringify(next));
        return next;
      });
    }, 1000);
    return () => clearTimeout(handler);
  }, [filterText]);
  // 大盘总览页隐藏 All 选项，默认选中第一个分类
  const effectiveCategory = useMemo(() => {
    if (selectedCategory === 'All' && categoryTabs.length > 0) {
      return categoryTabs[0][0];
    }
    return selectedCategory;
  }, [selectedCategory, categoryTabs]);

  useEffect(() => {
    if (selectedCategory === 'All' && categoryTabs.length > 0) {
      onCategoryChange(categoryTabs[0][0]);
    }
  }, [selectedCategory, categoryTabs, onCategoryChange]);

  // overviewParams 已由 useGlobalFilters 按 selectedCategory 的 label 查到对应的英文 value，
  // 此处直接透传，不要用中文 label 覆盖（否则后端 IN 查询匹配不到英文 category 字段，返回空）。
  const { data } = useOverviewAggregation(overviewParams);
  const dynamicStats = data?.summary;
  const priceDistribution = data?.price_distribution ?? [];
  const scatterData: ScatterDatum[] = data?.price_sales_scatter ?? [];
  const brandRanking: BrandRankDatum[] = data?.brand_ranking ?? [];

  return (
    <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="page-header">
        <div>
          <h1>大盘总览</h1>
          <p style={{ color: 'var(--text-muted)' }}>您的实时电商洞察指挥中心</p>
        </div>
        <div style={{ position: 'relative', width: '300px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input search-input"
              placeholder="过滤特定商品 (如 massage gun)..."
              style={{ width: '100%', paddingLeft: '2.5rem', borderRadius: '20px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)' }}
              value={filterText}
              onChange={(e) => onFilterTextChange(e.target.value)}
            />
          </div>
          {recentSearches.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'flex-end' }}>
              {recentSearches.map(k => (
                <span
                  key={k}
                  onClick={() => onFilterTextChange(k)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.6rem',
                    borderRadius: '12px',
                    background: 'var(--surface-3)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap',
                    border: '1px solid var(--border)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = 'var(--text)';
                    e.currentTarget.style.background = 'rgba(96, 165, 250, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = 'var(--text-muted)';
                    e.currentTarget.style.background = 'var(--surface-3)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <CategoryTabs
          tabs={categoryTabs}
          selected={effectiveCategory}
          onChange={onCategoryChange}
          allLabel="大盘总览 (All)"
          showAll={false}
        />
      </div>

      <div className="bento-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="glass-panel bento-col-4" style={{ padding: '1.5rem' }}>
          <div className="flex items-center gap-4">
            <div style={{ background: 'rgba(96, 165, 250, 0.1)', padding: '1rem', borderRadius: '1rem' }}>
              <Package color="var(--primary)" size={24} />
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>该品类收录数</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{dynamicStats?.total_products || 0}</h2>
            </div>
          </div>
        </div>
        <div className="glass-panel bento-col-4" style={{ padding: '1.5rem' }}>
          <div className="flex items-center gap-4">
            <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '1rem', borderRadius: '1rem' }}>
              <TrendingUp color="var(--success)" size={24} />
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>有效在售/活跃</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{dynamicStats?.active_products || 0}</h2>
            </div>
          </div>
        </div>
        <div className="glass-panel bento-col-4" style={{ padding: '1.5rem' }}>
          <div className="flex items-center gap-4">
            <div style={{ background: 'rgba(167, 139, 250, 0.1)', padding: '1rem', borderRadius: '1rem' }}>
              <Activity color="#a78bfa" size={24} />
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500 }}>总销售热度 (预估)</p>
              <h2 style={{ fontSize: '2rem', margin: 0 }}>{dynamicStats?.total_reviews || 0}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="bento-grid">
        <div className="glass-panel bento-col-12" style={{ padding: '1.5rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
            <h3 className="flex items-center gap-2" style={{ margin: 0 }}><BarChart3 size={20} color="var(--primary)" /> 蓝海价格段分析</h3>
            <span className="chart-category-badge">{effectiveCategory}</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-1rem', marginBottom: '1rem' }}>柱条=商品数, 折线=总评论数</p>
          <div style={{ height: '340px', width: '100%' }}>
            {priceDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={priceDistribution} margin={{ top: 10, right: 20, left: 10, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={10} tickLine={false} axisLine={false} angle={-40} textAnchor="end" height={55} interval={0} />
                  <YAxis yAxisId="left" stroke="#60a5fa" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} label={{ value: '商品数 (个)', angle: -90, position: 'insideLeft', style: { fill: '#60a5fa', fontSize: 11 } }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#34d399" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} label={{ value: '总评论 (条)', angle: 90, position: 'insideRight', style: { fill: '#34d399', fontSize: 11 } }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar yAxisId="left" dataKey="productCount" name="商品数(竞争)" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={18} opacity={0.8} />
                  <Line yAxisId="right" type="monotone" dataKey="totalReviews" name="总评论(需求)" stroke="var(--success)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <BarChart3 size={48} color="var(--text-muted)" style={{ opacity: 0.3 }} />
                <p>暂无 {effectiveCategory} 的价格段分析数据</p>
                <span>请先抓取该分类的商品</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bento-grid" style={{ marginTop: '1.5rem' }}>
        <div className="glass-panel bento-col-6" style={{ padding: '1.5rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
            <h3 className="flex items-center gap-2" style={{ margin: 0 }}><Activity size={20} color="#f59e0b" /> 价格销量分布图</h3>
            <span className="chart-category-badge">{effectiveCategory}</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-1rem', marginBottom: '1rem' }}>气泡大小=评论数</p>
          <div style={{ height: '320px', width: '100%' }}>
            {scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis type="number" dataKey="price" name="价格" unit=" AED" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatNumber} label={{ value: '价格 (AED)', position: 'insideBottom', offset: -12, style: { fill: 'var(--chart-axis)', fontSize: 11 } }} />
                  <YAxis type="number" dataKey="sales" name="预估销量" unit=" 件" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatNumber} label={{ value: '预估销量 (件)', angle: -90, position: 'insideLeft', style: { fill: 'var(--chart-axis)', fontSize: 11 } }} />
                  <ZAxis type="number" dataKey="reviews" range={[20, 280]} name="评论数" />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as ScatterDatum;
                      return (
                        <div style={{ background: 'rgba(15,17,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{d.name}</p>
                          <p style={{ color: '#f59e0b' }}>价格: {d.price} AED</p>
                          <p style={{ color: '#34d399' }}>预估销量: {d.sales} 件</p>
                          <p style={{ color: '#60a5fa' }}>评论数: {d.reviews}</p>
                          <p style={{ color: '#a78bfa' }}>评分: {d.rating || '无'}</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter name="商品" data={scatterData} fill="#f59e0b" fillOpacity={0.55} />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <Activity size={48} color="var(--text-muted)" style={{ opacity: 0.3 }} />
                <p>暂无 {effectiveCategory} 的销量分布数据</p>
                <span>请先抓取该分类的商品</span>
              </div>
            )}
          </div>
        </div>

        <div className="glass-panel bento-col-6" style={{ padding: '1.5rem' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem' }}>
            <h3 className="flex items-center gap-2" style={{ margin: 0 }}><BarChart3 size={20} color="#34d399" /> 品牌竞争力 TOP10</h3>
            <span className="chart-category-badge">{effectiveCategory}</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-1rem', marginBottom: '1rem' }}>按总评论数排名, 柱条=总评论, 标签=商品数</p>
          <div style={{ height: '320px', width: '100%' }}>
            {brandRanking.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={brandRanking} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                  <XAxis type="number" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatNumber} label={{ value: '总评论 (条)', position: 'insideBottom', offset: -5, style: { fill: 'var(--chart-axis)', fontSize: 11 } }} />
                  <YAxis type="category" dataKey="name" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as BrandRankDatum;
                      return (
                        <div style={{ background: 'rgba(15,17,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
                          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{d.name}</p>
                          <p style={{ color: '#34d399' }}>总评论: {d.总评论}</p>
                          <p style={{ color: '#60a5fa' }}>商品数: {d.商品数} 个</p>
                          <p style={{ color: '#f59e0b' }}>平均评分: {d.均分 || '无'}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="总评论" fill="url(#brandGradient)" radius={[0, 6, 6, 0]} barSize={18} />
                  <defs>
                    <linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#34d399" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty-state">
                <BarChart3 size={48} color="var(--text-muted)" style={{ opacity: 0.3 }} />
                <p>暂无 {effectiveCategory} 的品牌数据</p>
                <span>请先抓取该分类的商品</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
