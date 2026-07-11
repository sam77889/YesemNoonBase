import { useProducts, useTasks } from '../hooks/useProducts';
import { useGlobalFilters } from '../hooks/useGlobalFilters';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

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

      {/* 趋势图表卡片 */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>监控池商品增长趋势</div>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="value" stroke="var(--primary)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
