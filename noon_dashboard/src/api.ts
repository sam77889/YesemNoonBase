import axios from 'axios';

// Create an axios instance pointing to the FastAPI backend
// In production (behind the auth proxy), API is served from the same origin.
// For local dev without the proxy, temporarily set baseURL to http://localhost:8001/api/v1
export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─────────────────────────────────────────────
// 类型统一从 types/index.ts 导出，保持单一真源
// ─────────────────────────────────────────────
export type {
  Product,
  Task,
  Stats,
  Review,
  ReviewAnalysis,
  ReviewStatus,
  ReviewResponse,
  CategoryAnalysisJob,
  CategoryAnalysisResponse,
  AggregateRating,
  KeywordItem,
  SentimentDistribution,
  SentimentTimelineEntry,
} from './types';

import type {
  CategoryAnalysisJob,
  CategoryAnalysisResponse,
} from './types';

export const startCategoryAnalysis = (category: string) =>
  api.post<CategoryAnalysisJob>('/reviews/category/analyze', { category });

export const getCategoryAnalysis = (category: string, reviewLimit = 50) =>
  api.get<CategoryAnalysisResponse>(
    `/reviews/category/analysis?category=${encodeURIComponent(category)}&review_limit=${reviewLimit}`,
  );
