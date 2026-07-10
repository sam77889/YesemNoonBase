import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { ALL_CATEGORY_LABELS } from '../lib/categoryMap';
import type { CategoryCount, ProductQueryParams, SortState, OverviewQueryParams } from '../types';

/**
 * 全局筛选 + 列表/总览查询参数 + 类目 tab 聚合。
 * 把改造前散落在 App 的 filterText/selectedCategory/sort 与类目计数统一收敛到此处。
 */
export function useGlobalFilters() {
  const [filterText, setFilterText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sort, setSort] = useState<SortState>({ key: 'review_count', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 类目 tab 计数：直接使用后端的动态类目返回结果
  const { data: rawCounts = [] } = useQuery<CategoryCount[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get<CategoryCount[]>('/products/stats/categories');
      return res.data ?? [];
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // 合并静态映射分类与后端实际计数，确保所有分类都显示
  const categoryTabs = useMemo(() => {
    const countMap = new Map<string, number>();
    if (Array.isArray(rawCounts)) {
      rawCounts.forEach(item => countMap.set(item.label, item.count));
    }
    return ALL_CATEGORY_LABELS.map(label => [label, countMap.get(label) ?? 0] as [string, number]);
  }, [rawCounts]);

  // 过滤/排序/页大小变化时重置到第 1 页（避免停留在不存在的页）
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, filterText, sort, pageSize]);

  const categoryParam = useMemo(() => {
    if (selectedCategory === 'All') return undefined;
    const match = Array.isArray(rawCounts) ? rawCounts.find(c => c.label === selectedCategory) : undefined;
    return match ? match.value : undefined;
  }, [selectedCategory, rawCounts]);
  const qParam = filterText.trim() || undefined;

  const listParams: ProductQueryParams = useMemo(
    () => ({
      page,
      pageSize,
      category: categoryParam,
      q: qParam,
      sort: sort.key,
      order: sort.direction,
    }),
    [page, pageSize, categoryParam, qParam, sort],
  );

  const overviewParams: OverviewQueryParams = useMemo(
    () => ({ category: categoryParam, q: qParam }),
    [categoryParam, qParam],
  );

  return {
    filterText,
    setFilterText,
    selectedCategory,
    setSelectedCategory,
    sort,
    setSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    listParams,
    overviewParams,
    categoryTabs,
  };
}
