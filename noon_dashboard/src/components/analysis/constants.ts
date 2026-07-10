import type {
  Review,
  ReviewAnalysis,
  ReviewResponse,
  CategoryAnalysisResponse,
  KeywordItem,
  AnalysisData,
} from '../../types';
import { buildErrorResponse } from '../../lib/utils';

export type { AnalysisData, KeywordItem };

export const SENTIMENT_COLORS = {
  positive: '#34d399',
  neutral: '#fbbf24',
  negative: '#f87171',
} as const;

export const RATING_COLORS = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399'];

export interface RatingChartDatum {
  rating: string;
  count: number;
  fill: string;
}

export interface SentimentChartDatum {
  name: string;
  key?: 'positive' | 'neutral' | 'negative';
  value: number;
  color: string;
}

export interface LengthChartDatum {
  name: string;
  value: number;
  color: string;
}

export interface ChartData {
  ratingChartData: RatingChartDatum[];
  sentimentChartData: SentimentChartDatum[];
  textSentimentChartData: SentimentChartDatum[];
  lengthChartData: LengthChartDatum[];
}

export const buildChartData = (analysis: ReviewAnalysis): ChartData => {
  const ratingChartData: RatingChartDatum[] = Object.entries(analysis.rating_distribution).map(
    ([rating, count]) => ({
      rating: `${rating}星`,
      count,
      fill: RATING_COLORS[parseInt(rating) - 1] ?? '#94a3b8',
    }),
  );

  const sentimentChartData: SentimentChartDatum[] = [
    { name: '好评', key: 'positive', value: analysis.sentiment_distribution.positive, color: SENTIMENT_COLORS.positive },
    { name: '中评', key: 'neutral', value: analysis.sentiment_distribution.neutral, color: SENTIMENT_COLORS.neutral },
    { name: '差评', key: 'negative', value: analysis.sentiment_distribution.negative, color: SENTIMENT_COLORS.negative },
  ];

  const textDist = analysis.text_sentiment_distribution;
  const textSentimentChartData: SentimentChartDatum[] = textDist
    ? [
        { name: '好评', value: textDist.positive, color: SENTIMENT_COLORS.positive },
        { name: '中评', value: textDist.neutral, color: SENTIMENT_COLORS.neutral },
        { name: '差评', value: textDist.negative, color: SENTIMENT_COLORS.negative },
      ]
    : [];

  const lenDist = analysis.review_length_distribution;
  const lengthChartData: LengthChartDatum[] = lenDist
    ? [
        { name: '短评(<50字)', value: lenDist.short, color: '#94a3b8' },
        { name: '中评(50-200字)', value: lenDist.medium, color: '#60a5fa' },
        { name: '长评(>200字)', value: lenDist.long, color: '#a78bfa' },
      ]
    : [];

  return { ratingChartData, sentimentChartData, textSentimentChartData, lengthChartData };
};

export const getReliabilityMeta = (score: number) => {
  const label = score >= 0.8 ? '高' : score >= 0.5 ? '中' : '低';
  const color = score >= 0.8 ? '#34d399' : score >= 0.5 ? '#fbbf24' : '#f87171';
  return { label, color };
};

export const getReliabilityDescription = (score: number) =>
  score >= 0.8
    ? '评分与文本情感高度一致，评分参考价值高'
    : score >= 0.5
      ? '部分评论评分与文字情感不一致，需综合判断'
      : '评分与文字情感矛盾较多，建议重点关注文字内容';

// 复用共享的 buildErrorResponse，避免在两处重复定义空 ReviewResponse
export const EMPTY_REVIEW_RESPONSE: ReviewResponse = buildErrorResponse('');
export { buildErrorResponse };

// 重新导出 Review 类型，供其他模块兼容引用
export type { Review, ReviewAnalysis, ReviewResponse, CategoryAnalysisResponse };
