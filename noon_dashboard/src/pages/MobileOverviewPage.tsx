import { useEffect, useMemo } from 'react';
import { useProducts, useTasks } from '../hooks/useProducts';
import { useGlobalFilters } from '../hooks/useGlobalFilters';
import { useOverviewAggregation } from '../hooks/useOverviewAggregation';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, ComposedChart, Line, ScatterChart, Scatter, ZAxis } from 'recharts';
import { BarChart3, Activity } from 'lucide-react';
import { CategoryTabs } from '../components/CategoryTabs';
import { ChartTooltip } from '../components/analysis/ChartTooltip';
import { formatNumber } from '../lib/utils';

export function MobileOverviewPage() {
  const gf = useGlobalFilters();
  const { data: listData } = useProducts(gf.listParams);
  const { data: tasks = [] } = useTasks();

  const activeTasksCount = tasks.filter(t => t.status === 'running').length;
  const totalItemsCount = listData?.total ?? 0;

  // 模拟数据渲染折线图
  const chartData = [
    { name: '7/06', value: 400 },
    { name: '7/07', value: 450 },
    { name: '7/08', value: 480 },
    { name: '7/09', value: 520 },
    { name: '7/10', value: totalItemsCount },
  ];

  const effectiveCategory = useMemo(() => {
    if (gf.selectedCategory === 'All' && gf.categoryTabs.length > 0) {
      return gf.categoryTabs[0][0];
    }
    return gf.selectedCategory;
  }, [gf.selectedCategory, gf.categoryTabs]);

  useEffect(() => {
    if (gf.selectedCategory === 'All' && gf.categoryTabs.length > 0) {
      gf.setSelectedCategory(gf.categoryTabs[0][0]);
    }
  }, [gf.selectedCategory, gf.categoryTabs, gf.setSelectedCategory]);

  const { data: aggData } = useOverviewAggregation(gf.overviewParams);
  const priceDistribution = aggData?.price_distribution ?? [];
  const scatterData = aggData?.price_sales_scatter ?? [];
  const brandRanking = aggData?.brand_ranking ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* KPI 卡片网格 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>监控商品总数</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{totalItemsCount}</span>
        </div>
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>运行中爬虫数</span>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#eab308' }}>{activeTasksCount}</span>
        </div>
      </div>

      {/* 品类选择器 */}
      <CategoryTabs
        tabs={gf.categoryTabs}
        selected={effectiveCategory}
        onChange={gf.setSelectedCategory}
        showAll={false}
      />

      {/* 图表 1：蓝海价格段分析 */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="flex items-center justify-between">
          <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={16} color="var(--primary)" /> 价格段分析
          </div>
          <span className="chart-category-badge" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>{effectiveCategory}</span>
        </div>
        <div style={{ height: '260px', width: '100%' }}>
          {priceDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={priceDistribution} margin={{ top: 10, right: 0, left: -25, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={9} tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={35} interval={0} />
                <YAxis yAxisId="left" stroke="#60a5fa" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#34d399" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar yAxisId="left" dataKey="productCount" name="商品数" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={12} opacity={0.8} />
                <Line yAxisId="right" type="monotone" dataKey="totalReviews" name="总评论" stroke="var(--success)" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
              <BarChart3 size={32} />
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>暂无数据</p>
            </div>
          )}
        </div>
      </div>

      {/* 图表 2：价格销量分布图 */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="flex items-center justify-between">
          <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={16} color="#f59e0b" /> 价格销量分布
          </div>
          <span className="chart-category-badge" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>{effectiveCategory}</span>
        </div>
        <div style={{ height: '260px', width: '100%' }}>
          {scatterData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis type="number" dataKey="price" name="价格" unit=" AED" stroke="var(--chart-axis)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                <YAxis type="number" dataKey="sales" name="销量" unit=" 件" stroke="var(--chart-axis)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                <ZAxis type="number" dataKey="reviews" range={[20, 200]} name="评论数" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as any;
                    return (
                      <div style={{ background: 'rgba(15,17,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.75rem' }}>
                        <p style={{ fontWeight: 600, marginBottom: '0.2rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</p>
                        <p style={{ color: '#f59e0b' }}>价格: {d.price} AED</p>
                        <p style={{ color: '#34d399' }}>销量: {d.sales}</p>
                      </div>
                    );
                  }}
                />
                <Scatter name="商品" data={scatterData} fill="#f59e0b" fillOpacity={0.55} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
              <Activity size={32} />
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>暂无数据</p>
            </div>
          )}
        </div>
      </div>

      {/* 图表 3：品牌竞争力 TOP10 */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="flex items-center justify-between">
          <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={16} color="#34d399" /> 品牌排行 TOP10
          </div>
          <span className="chart-category-badge" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>{effectiveCategory}</span>
        </div>
        <div style={{ height: '260px', width: '100%' }}>
          {brandRanking.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={brandRanking} layout="vertical" margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
                <XAxis type="number" stroke="var(--chart-axis)" fontSize={9} tickLine={false} axisLine={false} tickFormatter={formatNumber} />
                <YAxis type="category" dataKey="name" stroke="var(--chart-axis)" fontSize={9} tickLine={false} axisLine={false} width={80} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as any;
                    return (
                      <div style={{ background: 'rgba(15,17,25,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.75rem' }}>
                        <p style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{d.name}</p>
                        <p style={{ color: '#34d399' }}>总评论: {d.总评论}</p>
                        <p style={{ color: '#60a5fa' }}>商品数: {d.商品数}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="总评论" fill="url(#mobileBrandGradient)" radius={[0, 4, 4, 0]} barSize={12} />
                <defs>
                  <linearGradient id="mobileBrandGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.4}/>
                    <stop offset="100%" stopColor="#34d399" stopOpacity={1}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
              <BarChart3 size={32} />
              <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>暂无数据</p>
            </div>
          )}
        </div>
      </div>

      {/* 原来的趋势图表卡片 */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>监控池商品增长趋势</div>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValueMobile" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={9} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={9} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="value" stroke="var(--primary)" fillOpacity={1} fill="url(#colorValueMobile)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

