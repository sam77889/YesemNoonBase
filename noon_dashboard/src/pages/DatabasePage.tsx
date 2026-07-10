import { motion } from 'framer-motion';
import { DatabaseTable } from '../components/DatabaseTable';
import { CategoryTabs } from '../components/CategoryTabs';
import type { Product } from '../api';
import type { SortState } from '../types';

interface DatabasePageProps {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSortingChange: (sort: SortState) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categoryTabs: [string, number][];
  onRowClick: (sku: string) => void;
  onBatchDelete: (skus: string[]) => void;
}

export function DatabasePage({
  items, total, page, pageSize, onPageChange, onPageSizeChange,
  onSortingChange, selectedCategory, onCategoryChange,
  categoryTabs, onRowClick, onBatchDelete
}: DatabasePageProps) {
  return (
    <motion.div
      key="database"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1>数据库 ({total} 件)</h1>
          <p style={{ color: 'var(--text-muted)' }}>已清洗入库的所有商品列表（点击可查看单品趋势）</p>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <CategoryTabs
          tabs={categoryTabs}
          selected={selectedCategory}
          onChange={onCategoryChange}
        />
      </div>

      <DatabaseTable
        data={items}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onSortingChange={onSortingChange}
        onRowClick={onRowClick}
        onBatchDelete={onBatchDelete}
      />
    </motion.div>
  );
}
