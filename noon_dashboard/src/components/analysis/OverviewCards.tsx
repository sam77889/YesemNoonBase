import { Star, ThumbsUp, ThumbsDown, FileText, CheckCircle2, Shield } from 'lucide-react';
import type { ReviewAnalysis } from '../../api';
import { getReliabilityMeta } from './constants';
import { centeredCardStyle as cardStyle, bigNumStyle, labelStyle } from '../../lib/styles';

interface OverviewCardsProps {
  count: number;
  analysis: ReviewAnalysis;
}

export function OverviewCards({ count, analysis }: OverviewCardsProps) {
  const { average_rating, sentiment_distribution, text_sentiment_distribution, verified_ratio, rating_reliability, avg_review_length } = analysis;

  const totalSentiment = sentiment_distribution.positive + sentiment_distribution.neutral + sentiment_distribution.negative || 1;
  const positiveRate = Math.round((sentiment_distribution.positive / totalSentiment) * 100);
  const negativeRate = Math.round((sentiment_distribution.negative / totalSentiment) * 100);
  const textTotal = text_sentiment_distribution
    ? text_sentiment_distribution.positive + text_sentiment_distribution.neutral + text_sentiment_distribution.negative || 1
    : 0;
  const textPositiveRate = text_sentiment_distribution
    ? Math.round((text_sentiment_distribution.positive / textTotal) * 100)
    : 0;

  const { label: reliabilityLabel, color: reliabilityColor } = getReliabilityMeta(rating_reliability ?? 0);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={cardStyle}>
        <div style={bigNumStyle('var(--primary)')}>{count}</div>
        <div style={labelStyle}>评论总数</div>
      </div>
      <div style={cardStyle}>
        <div style={bigNumStyle('#fbbf24')}>
          <Star size={18} /> {average_rating.toFixed(1)}
        </div>
        <div style={labelStyle}>平均评分</div>
      </div>
      <div style={cardStyle}>
        <div style={bigNumStyle('#34d399')}>
          <ThumbsUp size={18} /> {positiveRate}%
        </div>
        <div style={labelStyle}>评分好评率</div>
      </div>
      {text_sentiment_distribution && (
        <div style={cardStyle}>
          <div style={bigNumStyle('#60a5fa')}>
            <FileText size={18} /> {textPositiveRate}%
          </div>
          <div style={labelStyle}>文本好评率</div>
        </div>
      )}
      <div style={cardStyle}>
        <div style={bigNumStyle('#f87171')}>
          <ThumbsDown size={18} /> {negativeRate}%
        </div>
        <div style={labelStyle}>差评率</div>
      </div>
      {verified_ratio !== undefined && verified_ratio !== null && (
        <div style={cardStyle}>
          <div style={bigNumStyle('#60a5fa')}>
            <CheckCircle2 size={18} /> {Math.round(verified_ratio * 100)}%
          </div>
          <div style={labelStyle}>Verified</div>
        </div>
      )}
      {rating_reliability !== undefined && rating_reliability !== null && (
        <div style={cardStyle}>
          <div style={bigNumStyle(reliabilityColor)}>
            <Shield size={18} /> {reliabilityLabel}
          </div>
          <div style={labelStyle}>评分可靠性</div>
        </div>
      )}
      {avg_review_length !== undefined && avg_review_length !== null && (
        <div style={cardStyle}>
          <div style={{ ...bigNumStyle('#a78bfa'), gap: 0 }}>{avg_review_length}</div>
          <div style={labelStyle}>平均字数</div>
        </div>
      )}
    </div>
  );
}
