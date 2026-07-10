import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { FileText, Shield, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import type { ReviewAnalysis } from '../../api';
import {
  buildChartData, getReliabilityMeta, getReliabilityDescription, type KeywordItem,
} from './constants';
import { ChartTooltip } from './ChartTooltip';
import { cardStyle } from '../../lib/styles';

interface AnalysisChartsProps {
  analysis: ReviewAnalysis;
}

export function AnalysisCharts({ analysis }: AnalysisChartsProps) {
  const {
    sentiment_timeline, timeline, review_length_distribution, rating_reliability,
    text_sentiment_distribution, top_keywords, pros_keywords, cons_keywords,
  } = analysis;

  const { ratingChartData, sentimentChartData, textSentimentChartData, lengthChartData } = buildChartData(analysis);
  const reliabilityScore = rating_reliability ?? 0;
  const { color: reliabilityColor } = getReliabilityMeta(reliabilityScore);

  return (
    <>
      {/* Charts Row 1: Rating + Sentiment */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={cardStyle}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>评分分布</h3>
          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="rating" stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="评论数" radius={[4, 4, 0, 0]}>
                  {ratingChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={cardStyle}>
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
                <Tooltip content={<ChartTooltip />} />
                <Legend verticalAlign="bottom" height={24} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pros & Cons Keywords */}
      {((pros_keywords && pros_keywords.length > 0) || (cons_keywords && cons_keywords.length > 0)) && (
        <ProsConsPanel pros={pros_keywords ?? []} cons={cons_keywords ?? []} />
      )}

      {/* Sentiment Timeline */}
      {sentiment_timeline && sentiment_timeline.length > 1 && (
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>情感时间趋势</h3>
          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sentiment_timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="positive" name="好评" stackId="1" stroke="#34d399" fill="rgba(52, 211, 153, 0.3)" />
                <Area type="monotone" dataKey="neutral" name="中评" stackId="1" stroke="#fbbf24" fill="rgba(251, 191, 36, 0.3)" />
                <Area type="monotone" dataKey="negative" name="差评" stackId="1" stroke="#f87171" fill="rgba(248, 113, 113, 0.3)" />
                <Legend verticalAlign="top" height={24} iconType="circle" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Review Count Timeline (fallback) */}
      {timeline.length > 0 && (!sentiment_timeline || sentiment_timeline.length <= 1) && (
        <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>评论时间趋势</h3>
          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="count" name="评论数" stroke="var(--primary)" strokeWidth={3} dot={{ r: 3, fill: 'var(--primary)' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Review Quality Section */}
      {(review_length_distribution || rating_reliability !== undefined) && (
        <div style={{ display: 'grid', gridTemplateColumns: review_length_distribution ? '1fr 1fr' : '1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {review_length_distribution && (
            <div style={cardStyle}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} style={{ color: '#a78bfa' }} />
                评论长度分布
              </h3>
              <div style={{ width: '100%', height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lengthChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--chart-axis)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
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

          {rating_reliability !== undefined && rating_reliability !== null && (
            <div style={cardStyle}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={18} style={{ color: reliabilityColor }} />
                评分可靠性分析
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    border: `6px solid ${reliabilityColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${reliabilityColor}11`,
                    boxShadow: `0 0 30px ${reliabilityColor}33`,
                  }}
                >
                  <span style={{ fontSize: '2rem', fontWeight: 700, color: reliabilityColor }}>
                    {Math.round(reliabilityScore * 100)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>分</span>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '240px' }}>
                  {getReliabilityDescription(reliabilityScore)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keywords */}
      {top_keywords.length > 0 && <KeywordsPanel keywords={top_keywords} />}
    </>
  );
}

function ProsConsPanel({ pros, cons }: { pros: KeywordItem[]; cons: KeywordItem[] }) {
  const renderBars = (items: KeywordItem[], color: string, gradient: string) => {
    if (items.length === 0) return null;
    const maxCount = items[0]?.count || 1;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {items.map((kw, idx) => {
          const pct = Math.round((kw.count / maxCount) * 100);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ minWidth: '80px', fontSize: '0.85rem', fontWeight: 500, color }}>{kw.word}</span>
              <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: gradient, borderRadius: '4px', transition: 'width 0.5s ease' }} />
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '30px', textAlign: 'right' }}>{kw.count}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const sideCard = (title: string, icon: React.ReactNode, borderColor: string, items: KeywordItem[], color: string, gradient: string, fallback: string) => (
    <div style={{ ...cardStyle, padding: '1.25rem', border: `1px solid ${borderColor}` }}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {icon}
        {title}
      </h3>
      {items.length > 0 ? (
        renderBars(items, color, gradient)
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{fallback}</p>
      )}
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
      {sideCard(
        '优点关键词',
        <TrendingUp size={18} style={{ color: '#34d399' }} />,
        'rgba(52, 211, 153, 0.2)',
        pros,
        '#34d399',
        'linear-gradient(90deg, #34d399, #6ee7b7)',
        '暂无优点关键词',
      )}
      {sideCard(
        '缺点关键词',
        <TrendingDown size={18} style={{ color: '#f87171' }} />,
        'rgba(248, 113, 113, 0.2)',
        cons,
        '#f87171',
        'linear-gradient(90deg, #f87171, #fca5a5)',
        '暂无缺点关键词',
      )}
    </div>
  );
}

function KeywordsPanel({ keywords }: { keywords: KeywordItem[] }) {
  return (
    <div style={{ ...cardStyle, marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Zap size={18} style={{ color: 'var(--primary)' }} />
        高频关键词 TOP15
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {keywords.map((kw, idx) => (
          <span
            key={idx}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              background: idx < 3 ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${idx < 3 ? 'rgba(124, 58, 237, 0.5)' : 'var(--border-color)'}`,
              fontSize: '0.85rem',
              color: idx < 3 ? '#c4b5fd' : 'var(--text-main)',
            }}
          >
            {kw.word} <span style={{ opacity: 0.6, marginLeft: '0.25rem' }}>{kw.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
