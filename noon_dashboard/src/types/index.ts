/**
 * 共享类型定义 —— 全应用唯一的类型真源 (Single Source of Truth)
 *
 * 消除 api.ts / DatabaseTable.tsx / useReviewAnalysis.ts / SystemLogsPage.tsx 中
 * 重复定义的 Product / Task / ExecutionBlock 等类型。
 *
 * 引用方式：`import type { Product, Task, ExecutionBlock } from '@/types'`
 */

// ─────────────────────────────────────────────
// 商品 & 抓取任务
// ─────────────────────────────────────────────

export interface Product {
  sku: string;
  title: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  product_url: string | null;
  price?: number | null;
  original_price?: number | null;
  currency?: string;
  rating?: number;
  review_count?: number;
  is_express: boolean;
  status: string;
  updated_at: string;
}

export type TaskStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export interface Task {
  job_id: string;
  task_type: string;
  query: string;
  status: string;
  result_count: number | null;
  error_message: string | null;
  created_at: string;
}

export interface Stats {
  total_products: number;
  active_products: number;
  total_snapshots: number;
}

// ─────────────────────────────────────────────
// 性能优化 P0-1 / P0-3 新增类型
// ─────────────────────────────────────────────

export type SortKey = 'price' | 'review_count' | 'rating' | 'updated_at' | 'created_at' | 'title' | 'brand';

export interface SortState {
  key: SortKey;
  direction: 'asc' | 'desc';
}

export interface ProductQueryParams {
  page: number; // 1-based
  pageSize: number; // ≤100
  category?: string; // 原始英文，逗号分隔，或 '__UNCATEGORIZED__'
  q?: string;
  sort?: SortKey;
  order?: 'asc' | 'desc';
}

export interface ProductListResponse {
  items: Product[];
  total: number;
}

export interface CategoryCount {
  label: string;
  value: string;
  count: number;
}

export interface OverviewAggregation {
  summary: { total_products: number; active_products: number; total_reviews: number };
  price_distribution: { name: string; productCount: number; totalReviews: number }[];
  price_sales_scatter: {
    name: string;
    price: number | null;
    sales: number;
    reviews: number;
    rating: number;
  }[];
  brand_ranking: { name: string; 商品数: number; 总评论: number; 均分: number }[];
}

export interface OverviewQueryParams {
  category?: string;
  q?: string;
}

// ─────────────────────────────────────────────
// 评论 & 分析
// ─────────────────────────────────────────────

export interface Review {
  rating: number;
  title: string;
  body: string;
  created_at?: number;
  author?: string;
  helpful_count?: number;
  verified?: boolean;
}

export interface ReviewAnalysis {
  rating_distribution: Record<string, number>;
  average_rating: number;
  sentiment_distribution: SentimentDistribution;
  text_sentiment_distribution?: SentimentDistribution;
  top_keywords: KeywordItem[];
  pros_keywords?: KeywordItem[];
  cons_keywords?: KeywordItem[];
  timeline: { date: string; count: number }[];
  sentiment_timeline?: SentimentTimelineEntry[];
  verified_ratio?: number;
  avg_review_length?: number;
  review_length_distribution?: {
    short: number;
    medium: number;
    long: number;
  };
  rating_reliability?: number;
  summary?: string;
}

export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
}

export interface SentimentTimelineEntry {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface KeywordItem {
  word: string;
  count: number;
}

export type ReviewStatus = 'success' | 'intercepted' | 'empty' | 'error';

export interface AggregateRating {
  ratingValue?: number;
  reviewCount?: number;
  bestRating?: number;
}

export interface ReviewResponse {
  status: ReviewStatus;
  message: string;
  reviews: Review[];
  analysis: ReviewAnalysis;
  count: number;
  intercepted: boolean;
  aggregate_rating?: AggregateRating;
  product_name?: string;
  product_image?: string;
  from_cache?: boolean;
  cached_at?: string | null;
}

export interface CategoryAnalysisJob {
  job_id: string;
  message: string;
  total_products: number;
}

export interface CategoryAnalysisResponse extends ReviewResponse {
  category: string;
  product_count: number;
  review_count: number;
}

// `analysis.summary` 在实际后端响应里是字符串，但 ReviewResponse 里 analysis 字段是
// ReviewAnalysis 对象。AnalysisPage 用 `data.analysis.summary`，这里显式取出。
export type AnalysisData = ReviewResponse | CategoryAnalysisResponse;

// 类型守卫：判断是否为类目聚合数据
export function isCategoryAnalysis(
  data: AnalysisData,
): data is CategoryAnalysisResponse {
  return data !== null && typeof data === 'object' && 'category' in data;
}

// ─────────────────────────────────────────────
// 执行 / 日志
// ─────────────────────────────────────────────

export type ExecutionSource = 'analysis' | 'scraper' | 'fetcher';
export type ExecutionStatus = 'running' | 'success' | 'error';
export type LogType = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: LogType;
}

export interface ExecutionBlock {
  id: string;
  title: string;
  source: ExecutionSource;
  status: ExecutionStatus;
  timestamp: Date;
  logs: LogEntry[];
  progress: number;
}

/** 分析页执行更新回调的载荷 */
export interface ExecutionUpdate {
  id: string;
  title: string;
  source: ExecutionSource;
  status: ExecutionStatus;
  progress: number;
  logs: string[];
}

export type OnExecutionUpdate = (update: ExecutionUpdate) => void;

// ─────────────────────────────────────────────
// 分析页模式 & 爬虫 provider
// ─────────────────────────────────────────────

export type AnalysisMode = 'sku' | 'category';
export type ScraperProvider = 'fetcher' | 'scraperapi' | 'oxylabs';
export type PaidScraperProvider = Exclude<ScraperProvider, 'fetcher'>;

// ─────────────────────────────────────────────
// 价格历史（usePriceHistory 返回的单条记录）
// ─────────────────────────────────────────────

export interface PriceHistoryPoint {
  time: string;
  price: number | null;
  original_price: number | null;
  review_count: number;
}

export interface PriceSnapshotRaw {
  scraped_at: string;
  price: number | null;
  original_price: number | null;
  review_count: number;
}
