import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../api';
import { ChartTooltip } from './analysis/ChartTooltip';
import { hasNewPriceData, formatNumber } from '../lib/utils';
import type { PriceHistoryPoint, PriceSnapshotRaw } from '../types';
import { useQueryClient } from '@tanstack/react-query';

interface PriceTrendModalProps {
  selectedSku: string | null;
  priceHistory: PriceHistoryPoint[];
  refetchPriceHistory: () => void;
  onClose: () => void;
  onGoToAnalysis: (sku: string) => void;
}

export function PriceTrendModal({
  selectedSku,
  priceHistory,
  refetchPriceHistory,
  onClose,
  onGoToAnalysis,
}: PriceTrendModalProps) {
  const queryClient = useQueryClient();
  const [isRefreshingSku, setIsRefreshingSku] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // 对话框无障碍：Esc 关闭 + 打开时聚焦关闭按钮
  useEffect(() => {
    if (!selectedSku) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    closeBtnRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedSku, onClose]);

  return (
    <AnimatePresence>
      {selectedSku && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="modal-overlay"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 10, opacity: 0 }}
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="price-trend-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
              <div>
                <h2 id="price-trend-title" style={{ marginBottom: '0.25rem' }}>价格波动趋势</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>SKU: {selectedSku}</p>
              </div>
              <button
                ref={closeBtnRef}
                onClick={onClose}
                aria-label="关闭价格波动趋势"
                style={{ background: 'var(--surface-3)', border: 'none', color: 'var(--text-main)', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--success)' }}>
                提示：销量趋势 = 最近两次抓取的评价数 (review_count) 之差 ÷ 1% 留评率估算得出
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '8px', cursor: 'pointer', background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}
                  onClick={() => {
                    if (!selectedSku) return;
                    onGoToAnalysis(selectedSku);
                  }}
                >
                  深度分析
                </button>
                <button
                  className="btn"
                  disabled={isRefreshingSku}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '8px', opacity: isRefreshingSku ? 0.7 : 1, cursor: isRefreshingSku ? 'not-allowed' : 'pointer' }}
                  onClick={async () => {
                    if (isRefreshingSku || !selectedSku) return;
                    setIsRefreshingSku(true);
                    try {
                      await api.post('/tasks/search', {
                        task_type: 'SEARCH',
                        query: selectedSku,
                        country: 'uae',
                        language: 'en',
                        provider: 'fetcher',
                      });

                      queryClient.invalidateQueries({ queryKey: ['products'] });
                      queryClient.invalidateQueries({ queryKey: ['tasks'] });
                      queryClient.invalidateQueries({ queryKey: ['stats'] });
                      queryClient.invalidateQueries({ queryKey: ['categories'] });
                      queryClient.invalidateQueries({ queryKey: ['overview'] });

                      const startTime = Date.now();
                      let attempts = 0;
                      const pollInterval = setInterval(async () => {
                        attempts++;
                        try {
                          const res = await api.get(`/products/${encodeURIComponent(selectedSku)}/prices`);
                          const rawData = res.data as PriceSnapshotRaw[];
                          if (hasNewPriceData(rawData, startTime) || attempts >= 15) {
                            clearInterval(pollInterval);
                            refetchPriceHistory();
                            queryClient.invalidateQueries({ queryKey: ['products'] });
                            queryClient.invalidateQueries({ queryKey: ['stats'] });
                            queryClient.invalidateQueries({ queryKey: ['categories'] });
                            queryClient.invalidateQueries({ queryKey: ['overview'] });
                            setIsRefreshingSku(false);
                          }
                        } catch (err) {
                          console.error(err);
                          if (attempts >= 15) {
                            clearInterval(pollInterval);
                            setIsRefreshingSku(false);
                          }
                        }
                      }, 3000);
                    } catch (e) {
                      console.error(e);
                      setIsRefreshingSku(false);
                    }
                  }}
                >
                  <RefreshCw size={14} className={isRefreshingSku ? 'spin' : ''} />
                  {isRefreshingSku ? '抓取中...' : '最新数据'}
                </button>
              </div>
            </div>

            <div style={{ width: '100%', height: '350px' }}>
              {priceHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis dataKey="time" stroke="var(--chart-axis)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="#60a5fa" fontSize={12} tickLine={false} axisLine={false} domain={[(dataMin: number) => Math.max(0, dataMin - 20), 'dataMax + 20']} tickFormatter={formatNumber} />
                    <YAxis yAxisId="right" orientation="right" stroke="#34d399" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin', 'auto']} tickFormatter={formatNumber} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line yAxisId="left" type="monotone" dataKey="price" name="实时售价 (AED)" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--primary)' }} activeDot={{ r: 6 }} />
                    <Line yAxisId="left" type="monotone" dataKey="original_price" name="原始标价" stroke="var(--text-muted)" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="stepAfter" dataKey="review_count" name="累计评价数" stroke="var(--success)" strokeWidth={3} dot={{ r: 4, fill: 'var(--success)' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center" style={{ height: '100%', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw className="spin" size={24} />
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
