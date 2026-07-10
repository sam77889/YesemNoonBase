import { useState, useEffect, useRef, useCallback } from 'react';
import { api, startCategoryAnalysis, getCategoryAnalysis } from '../api';
import type {
  ReviewResponse,
  CategoryAnalysisResponse,
  AnalysisData,
  AnalysisMode,
  ExecutionSource,
  ExecutionStatus,
  ExecutionUpdate,
  OnExecutionUpdate,
} from '../types';
import { isCategoryAnalysis } from '../types';
import { buildErrorResponse, extractApiError } from '../lib/utils';

export type { ExecutionSource, ExecutionStatus, ExecutionUpdate, OnExecutionUpdate };

const SKU_LOG_SEQUENCE = (sku: string) => [
  `> 初始化针对 SKU [${sku}] 的深度分析任务...`,
  `> 建立网络请求上下文...`,
  `> 分配请求到高匿轮询代理池...`,
  `> 尝试与 Noon 服务器建立连接...`,
  `> 注入浏览器特征指纹，规避 Akamai Bot Manager...`,
  `> 成功触达页面，解析目标商品详情 (SKU: ${sku})...`,
  `> 正在提取 JSON-LD 内嵌的 Review 数据集...`,
  `> 对评论文本进行 NLP 情感极性计算...`,
  `> 提取高频特征词，区分 Pros / Cons...`,
  `> 调用 deep-translator 引擎进行中文本地化...`,
  `> 正在生成多维度综合数据及 AI 智能摘要...`,
  `> 即将完成，正在渲染可视化图表...`,
];

// ── localStorage 持久化：刷新/切换标签页后恢复最后一次分析结果 ──
// 单品与类目分页面独立缓存，互不覆盖
const CACHE_PREFIX = 'noon_analysis_';
// 单品分析进行中的哨兵值：写入缓存后，组件重挂载时会恢复（重新拉取）该分析
const SKU_RUNNING = '__sku_running__';

interface PersistedState {
  data: AnalysisData | null;
  skuInput: string;
  selectedCategory: string;
  runningJobId?: string | null;
  runningCategory?: string | null;
}

const loadPersistedState = (mode: AnalysisMode): PersistedState | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + mode);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
};

const updatePersistedState = (mode: AnalysisMode, updates: Partial<PersistedState>) => {
  try {
    const current = loadPersistedState(mode) || {
      data: null,
      skuInput: '',
      selectedCategory: ''
    };
    const newState = { ...current, ...updates };
    localStorage.setItem(CACHE_PREFIX + mode, JSON.stringify(newState));
  } catch {
    // localStorage 满或不可用，静默忽略
  }
};

const savePersistedState = (mode: AnalysisMode, state: PersistedState) => {
  updatePersistedState(mode, state);
};

export interface UseReviewAnalysisOptions {
  mode: AnalysisMode; // 固定模式：'sku' 单品分析 / 'category' 类目聚合
  initialSku?: string;
  autoRun?: boolean;
  onAutoRunConsumed?: () => void;
  onExecutionUpdate?: OnExecutionUpdate;
}

export interface UseReviewAnalysisReturn {
  mode: AnalysisMode;
  skuInput: string;
  setSkuInput: (s: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  data: AnalysisData | null;
  loading: boolean;
  analyzeSku: (sku: string, refresh?: boolean) => Promise<void>;
  refreshSku: (sku: string) => Promise<void>;
  analyzeCategory: (category: string) => Promise<void>;
}

export function useReviewAnalysis({
  mode,
  initialSku,
  autoRun,
  onAutoRunConsumed,
  onExecutionUpdate,
}: UseReviewAnalysisOptions): UseReviewAnalysisReturn {
  // 初始化时尝试从对应模式的 localStorage 恢复上一次结果
  const restored = useRef<PersistedState | null>(loadPersistedState(mode));

  const [skuInput, setSkuInput] = useState(initialSku || restored.current?.skuInput || '');
  const [selectedCategory, setSelectedCategory] = useState(restored.current?.selectedCategory ?? '');
  const [data, setDataState] = useState<AnalysisData | null>(restored.current?.data ?? null);
  const [loading, setLoading] = useState(!!restored.current?.runningJobId);
  const loadingLogsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsBufferRef = useRef(new Map<string, string[]>());
  // 当前在途请求的中止控制器：切换标签页卸载时中止，避免重挂载后请求并发导致日志重复
  const abortRef = useRef<AbortController | null>(null);
  // 挂载标记：卸载后置 false，避免卸载后的异步回调（如类目轮询启动）操作已卸载实例
  const mountedRef = useRef(true);

  // 包装 setData：同步持久化到 localStorage（按模式独立缓存）
  const setData = useCallback(
    (newData: AnalysisData | null) => {
      setDataState(newData);
      if (newData && newData.status === 'success') {
        savePersistedState(mode, {
          data: newData,
          skuInput,
          selectedCategory,
          runningJobId: null,
          runningCategory: null,
        });
      }
    },
    [mode, skuInput, selectedCategory],
  );

  const pushExecution = useCallback(
    (
      execId: string,
      title: string,
      msg: string,
      opts: { isEnd?: boolean; err?: boolean; progress?: number } = {},
    ) => {
      logsBufferRef.current.set(execId, [...(logsBufferRef.current.get(execId) ?? []), msg]);
      const logs = logsBufferRef.current.get(execId) ?? [msg];
      const isEnd = opts.isEnd ?? false;
      const err = opts.err ?? false;
      const status: ExecutionStatus = isEnd ? (err ? 'error' : 'success') : 'running';
      const progress = isEnd ? 100 : opts.progress ?? 0;
      onExecutionUpdate?.({ id: execId, title, source: 'analysis', status, progress, logs });
    },
    [onExecutionUpdate],
  );

  const analyzeSku = useCallback(
    async (targetSku: string, refresh = false) => {
      if (!targetSku.trim()) return;
      // 中止上一次可能仍在途的请求，避免并发导致日志/结果重复
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setDataState(null);
      // 标记单品分析进行中，重挂载时据此恢复（避免切换标签页后分析被丢弃）
      updatePersistedState(mode, { runningJobId: SKU_RUNNING, skuInput: targetSku });

      // 稳定的 execId：同一 SKU 的多次尝试共用一个日志块，避免重挂载产生重复任务
      const execId = `analysis-${targetSku}`;
      const title = `深度分析 - SKU: ${targetSku}`;
      logsBufferRef.current.set(execId, []);

      pushExecution(
        execId,
        title,
        refresh
          ? `> 强制重新抓取 SKU [${targetSku}] 的最新评论...`
          : `> 初始化针对 SKU [${targetSku}] 的深度分析任务（本地优先）...`,
      );

      // 组件卸载/主动取消：静默退出，不写错误日志、不清哨兵（便于重挂载恢复）
      const isCanceled = (e: unknown) =>
        (e as { name?: string; code?: string })?.name === 'CanceledError' ||
        (e as { name?: string; code?: string })?.code === 'ERR_CANCELED';

      // 本地优先模式：不播模拟日志，直接秒回
      if (!refresh) {
        try {
          const res = await api.get<ReviewResponse>(
            `/products/${encodeURIComponent(targetSku)}/reviews`,
            { signal: controller.signal },
          );
          if (res.data.from_cache) {
            pushExecution(execId, title, `> 命中本地缓存，秒级加载已持久化的评论数据。`, {
              isEnd: true,
            });
          } else {
            pushExecution(execId, title, `> 本地无缓存，已实时抓取并持久化。`, {
              isEnd: true,
            });
          }
          setData(res.data);
        } catch (err: unknown) {
          if (isCanceled(err)) return;
          const msg = extractApiError(err);
          pushExecution(execId, title, `> [致命错误] 分析任务中断: ${msg}`, {
            isEnd: true,
            err: true,
          });
          setData(buildErrorResponse(msg));
          // 失败也清除进行中标记，避免重挂载后无限重试
          updatePersistedState(mode, { runningJobId: null });
        } finally {
          setLoading(false);
        }
        return;
      }

      // refresh 模式：播放完整模拟日志
      const sequence = SKU_LOG_SEQUENCE(targetSku);
      let step = 0;
      loadingLogsRef.current = setInterval(() => {
        if (step < sequence.length) {
          pushExecution(execId, title, sequence[step], { progress: Math.min(95, step * 10) });
          step++;
        }
      }, 600);

      try {
        const res = await api.get<ReviewResponse>(
          `/products/${encodeURIComponent(targetSku)}/reviews`,
          { params: { refresh: true }, signal: controller.signal },
        );
        if (loadingLogsRef.current) clearInterval(loadingLogsRef.current);
        pushExecution(execId, title, `> 重新抓取完成！已更新本地缓存。`, { isEnd: true });
        setData(res.data);
      } catch (err: unknown) {
        if (loadingLogsRef.current) clearInterval(loadingLogsRef.current);
        if (isCanceled(err)) return;
        const msg = extractApiError(err);
        pushExecution(execId, title, `> [致命错误] 分析任务中断: ${msg}`, {
          isEnd: true,
          err: true,
        });
        setData(buildErrorResponse(msg));
        // 失败也清除进行中标记，避免重挂载后无限重试
        updatePersistedState(mode, { runningJobId: null });
      } finally {
        setLoading(false);
      }
    },
    [pushExecution, setData],
  );

  const pollCategoryTask = useCallback(
    (jobId: string, category: string, execId: string, title: string) => {
      setLoading(true);

      if (pollRef.current) {
        clearInterval(pollRef.current);
      }

      // 若组件已卸载（如切换标签页过程中启动），不启动轮询，交由重挂载的恢复逻辑接管
      if (!mountedRef.current) return;

      pollRef.current = setInterval(async () => {
        try {
          const taskRes = await api.get(`/tasks/${encodeURIComponent(jobId)}`);
          const task = taskRes.data;
          pushExecution(execId, title, `> 任务状态: ${task.status}...`, { progress: 30 });

          if (task.status === 'SUCCESS') {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            pushExecution(execId, title, `> 后台抓取完成，正在聚合分析...`, { progress: 80 });
            const analysisRes = await getCategoryAnalysis(category);
            pushExecution(execId, title, `> 分析完成！成功聚合类目评论数据。`, { isEnd: true });
            
            const newData = analysisRes.data;
            setDataState(newData);
            setLoading(false);

            updatePersistedState('category', {
              data: newData,
              selectedCategory: category,
              runningJobId: null,
              runningCategory: null,
            });
          } else if (task.status === 'FAILED') {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            const failMsg = task.error_message || '未知错误';
            pushExecution(execId, title, `> [错误] 后台任务失败: ${failMsg}`, {
              isEnd: true,
              err: true,
            });
            const newData = {
              ...buildErrorResponse(failMsg),
              category,
              product_count: 0,
              review_count: 0,
            } as CategoryAnalysisResponse;
            setDataState(newData);
            setLoading(false);

            updatePersistedState('category', {
              data: newData,
              selectedCategory: category,
              runningJobId: null,
              runningCategory: null,
            });
          }
        } catch (err: unknown) {
          const msg = extractApiError(err);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          pushExecution(execId, title, `> [错误] 轮询任务状态失败: ${msg}`, {
            isEnd: true,
            err: true,
          });
          setLoading(false);
          updatePersistedState('category', {
            runningJobId: null,
            runningCategory: null,
          });
        }
      }, 5000);
    },
    [pushExecution]
  );

  const analyzeCategory = useCallback(
    async (category: string) => {
      if (!category || category === 'All') return;
      setLoading(true);
      setDataState(null);

      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }

      // 稳定的 execId：同一类目复用同一日志块，避免重挂载产生重复任务
      const execId = `category-analysis-${category}`;
      const title = `深度分析 - 类目: ${category}`;
      logsBufferRef.current.set(execId, []);

      pushExecution(execId, title, `> 初始化针对类目 [${category}] 的评论聚合分析任务...`);

        try {
        const startRes = await startCategoryAnalysis(category);
        const { job_id, total_products } = startRes.data;
        pushExecution(execId, title, `> 已创建后台任务 ${job_id}，覆盖 ${total_products} 个商品...`, {
          progress: 10,
        });

        updatePersistedState('category', {
          selectedCategory: category,
          runningJobId: job_id,
          runningCategory: category,
        });

        pollCategoryTask(job_id, category, execId, title);
      } catch (err: unknown) {
        const msg = extractApiError(err);
        pushExecution(execId, title, `> [错误] 启动类目分析失败: ${msg}`, {
          isEnd: true,
          err: true,
        });
        setLoading(false);
      }
    },
    [pushExecution, pollCategoryTask],
  );

  // 用 ref 持有最新回调，避免把 analyzeSku 等放进依赖导致输入时重复触发
  const analyzeSkuRef = useRef(analyzeSku);
  analyzeSkuRef.current = analyzeSku;
  const pollCategoryTaskRef = useRef(pollCategoryTask);
  pollCategoryTaskRef.current = pollCategoryTask;
  const pushExecutionRef = useRef(pushExecution);
  pushExecutionRef.current = pushExecution;
  // 防止 autoRun 被消费（置 false）后本 effect 重跑时重复触发分析
  const autoRanRef = useRef(false);

  // 挂载时：autoRun 触发 或 恢复进行中的分析（切换标签页/刷新后）
  useEffect(() => {
    if (mode === 'sku') {
      if (autoRun && initialSku && !autoRanRef.current) {
        autoRanRef.current = true;
        void analyzeSkuRef.current(initialSku);
        onAutoRunConsumed?.();
        return;
      }
      // 重挂载时若单品分析仍在进行中（哨兵标记），恢复该分析
      const rj = restored.current?.runningJobId;
      if (rj === SKU_RUNNING && restored.current?.skuInput && !autoRanRef.current) {
        autoRanRef.current = true;
        void analyzeSkuRef.current(restored.current.skuInput);
      }
      return;
    }
    // 类目：恢复后台轮询任务（execId 与首次分析一致，复用同一日志块）
    if (restored.current?.runningJobId && restored.current?.runningCategory) {
      const jobId = restored.current.runningJobId;
      const category = restored.current.runningCategory;
      const execId = `category-analysis-${category}`;
      const title = `深度分析 - 类目: ${category}`;
      logsBufferRef.current.set(execId, []);
      pushExecutionRef.current(execId, title, `> 恢复针对类目 [${category}] 的评论聚合分析任务状态...`);
      pollCategoryTaskRef.current(jobId, category, execId, title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, autoRun, initialSku]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (loadingLogsRef.current) clearInterval(loadingLogsRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      // 卸载时中止在途请求，避免重挂载后产生并发的重复分析任务
      abortRef.current?.abort();
    };
  }, []);

  return {
    mode,
    skuInput,
    setSkuInput,
    selectedCategory,
    setSelectedCategory,
    data,
    loading,
    analyzeSku,
    refreshSku: (sku: string) => analyzeSku(sku, true),
    analyzeCategory,
  };
}

// 重新导出 isCategoryAnalysis，供 AnalysisPage 使用
export { isCategoryAnalysis };
