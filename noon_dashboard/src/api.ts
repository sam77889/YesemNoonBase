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

export interface Product {
  sku: string;
  title: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  product_url: string | null;
  price?: number;
  original_price?: number;
  currency?: string;
  rating?: number;
  review_count?: number;
  is_express: boolean;
  status: string;
  updated_at: string;
}

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
  sentiment_distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  text_sentiment_distribution?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  top_keywords: { word: string; count: number }[];
  pros_keywords?: { word: string; count: number }[];
  cons_keywords?: { word: string; count: number }[];
  timeline: { date: string; count: number }[];
  sentiment_timeline?: {
    date: string;
    positive: number;
    neutral: number;
    negative: number;
  }[];
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

export type ReviewStatus = 'success' | 'intercepted' | 'empty' | 'error';

export interface ReviewResponse {
  status: ReviewStatus;
  message: string;
  reviews: Review[];
  analysis: ReviewAnalysis;
  count: number;
  intercepted: boolean;
}