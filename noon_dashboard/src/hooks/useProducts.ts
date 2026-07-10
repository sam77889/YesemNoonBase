import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../api';
import type { Stats, Task, PriceSnapshotRaw, PriceHistoryPoint, ProductListResponse, ProductQueryParams } from '../types';
import { aggregateDailySnapshots } from '../lib/utils';

export function useProducts(params: ProductQueryParams) {
  return useQuery<ProductListResponse>({
    queryKey: ['products', params],
    queryFn: async () => {
      const { page, pageSize, category, q, sort, order } = params;
      const res = await api.get<ProductListResponse>('/products/', {
        params: {
          skip: (page - 1) * pageSize,
          limit: pageSize,
          ...(category ? { category } : {}),
          ...(q ? { q } : {}),
          ...(sort ? { sort, order } : {}),
        },
      });
      return res.data;
    },
    placeholderData: keepPreviousData, // 翻页时不闪烁
    refetchInterval: 30000, // 30 seconds
    staleTime: 10000,
  });
}

export function useStats() {
  return useQuery<Stats | null>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await api.get<Stats>('/products/stats');
      return res.data && typeof res.data === 'object' ? res.data : null;
    },
    refetchInterval: 10000, // 10 seconds
    staleTime: 5000,
  });
}

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await api.get<Task[]>('/tasks/?limit=20');
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: (query) => {
      // Only poll frequently when there are active tasks
      const hasActiveTasks = query.state.data?.some(
        (t) => t.status === 'PROCESSING' || t.status === 'PENDING',
      );
      return hasActiveTasks ? 5000 : 30000;
    },
    staleTime: 3000,
  });
}

export function usePriceHistory(sku: string | null) {
  return useQuery<PriceHistoryPoint[]>({
    queryKey: ['priceHistory', sku],
    queryFn: async () => {
      if (!sku) return [];
      const res = await api.get(`/products/${encodeURIComponent(sku)}/prices`);
      return aggregateDailySnapshots(res.data as PriceSnapshotRaw[]);
    },
    enabled: !!sku,
  });
}
