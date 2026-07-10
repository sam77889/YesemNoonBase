import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { OverviewAggregation } from '../types';

export interface OverviewQueryParams {
  category?: string;
  q?: string;
}

/** 调服务端聚合接口 /products/stats/overview，避免首屏拉取全量数据。 */
export function useOverviewAggregation(params: OverviewQueryParams) {
  return useQuery<OverviewAggregation>({
    queryKey: ['overview', params],
    queryFn: async () => {
      const res = await api.get<OverviewAggregation>('/products/stats/overview', {
        params: {
          ...(params.category ? { category: params.category } : {}),
          ...(params.q ? { q: params.q } : {}),
        },
      });
      return res.data;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}
