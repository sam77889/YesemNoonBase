import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useTasks } from './useProducts';
import { inferLogType } from '../lib/utils';
import type {
  ExecutionBlock,
  ExecutionSource,
  ExecutionStatus,
  ExecutionUpdate,
  LogEntry,
  ScraperProvider,
  Task,
} from '../types';

/**
 * 抓取编排 hook（从原 App 上帝组件抽离）。
 * 封装：执行块状态、triggerScrape / pollTaskUntilDone / 任务状态同步 effect。
 * 抓取终态后失效 products / stats / overview / categories，保证大盘一致刷新。
 */
export function useScrapeController() {
  const queryClient = useQueryClient();
  const { data: tasks = [] } = useTasks();
  const [scraping, setScraping] = useState(false);
  const [waitingForLog, setWaitingForLog] = useState(false);
  const [executionBlocks, setExecutionBlocks] = useState<ExecutionBlock[]>([]);
  const taskPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleExecutionUpdate = (
    id: string,
    title: string,
    source: ExecutionSource,
    status: ExecutionStatus,
    progress: number,
    logs: string[],
  ) => {
    setExecutionBlocks(prev => {
      const newBlocks = [...prev];
      const idx = newBlocks.findIndex(b => b.id === id);
      const parsedLogs: LogEntry[] = logs.map((msg, i) => ({
        id: `${id}-log-${i}`,
        timestamp: new Date(),
        message: msg,
        type: inferLogType(msg) as LogEntry['type'],
      }));
      if (idx === -1) {
        newBlocks.unshift({ id, title, source, status, timestamp: new Date(), logs: parsedLogs, progress });
      } else {
        newBlocks[idx] = { ...newBlocks[idx], status, logs: parsedLogs, progress };
      }
      return newBlocks;
    });
  };

  // Adapter for the new AnalysisPage execution-update signature
  const handleAnalysisExecutionUpdate = (update: ExecutionUpdate) => {
    handleExecutionUpdate(update.id, update.title, update.source, update.status, update.progress, update.logs);
  };

  // 清理轮询定时器
  useEffect(() => {
    return () => {
      if (taskPollRef.current) {
        clearInterval(taskPollRef.current);
      }
    };
  }, []);

  // 主动轮询单个任务直到终态（SUCCESS / FAILED）。
  const pollTaskUntilDone = (jobId: string) => {
    if (taskPollRef.current) clearInterval(taskPollRef.current);
    let attempts = 0;
    const maxAttempts = 180; // ~6min @ 2s，覆盖多页深潜抓取
    taskPollRef.current = setInterval(async () => {
      attempts++;
      await queryClient.refetchQueries({ queryKey: ['tasks'] });
      const current = queryClient.getQueryData<Task[]>(['tasks']);
      const t = current?.find(x => x.job_id === jobId);
      const done = t && (t.status === 'SUCCESS' || t.status === 'FAILED');
      if (done || attempts >= maxAttempts) {
        if (taskPollRef.current) clearInterval(taskPollRef.current);
        taskPollRef.current = null;
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['stats'] });
        queryClient.invalidateQueries({ queryKey: ['overview'] });
        queryClient.invalidateQueries({ queryKey: ['categories'] });
      }
    }, 2000);
  };

  const triggerScrape = async (query: string, pages: number, provider: ScraperProvider) => {
    setScraping(true);
    setWaitingForLog(true);
    try {
      const res = await api.post('/tasks/search', {
        task_type: 'SEARCH',
        query,
        country: 'uae',
        language: 'en',
        pages,
        provider,
      });

      const jobId = res.data.job_id;
      if (jobId) {
        const initialLog = provider === 'fetcher'
          ? '> 建立网络请求上下文...\n> 注入浏览器特征指纹，规避 Akamai Bot Manager...'
          : '> 正在向代理池下发任务，分配高匿节点...';

        const title = `${provider === 'fetcher' ? '本地直搜' : '付费搜查'} - ${query}`;
        handleExecutionUpdate(jobId, title, provider === 'fetcher' ? 'fetcher' : 'scraper', 'running', 10, initialLog.split('\n'));

        // 主动跟踪该任务直到终态，避免进度条在完成后仍反复播放加载动画
        pollTaskUntilDone(jobId);
      }

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
    } catch (error) {
      console.error('Scraping failed:', error);
      alert('Failed to start scraping task.');
    } finally {
      setScraping(false);
      setTimeout(() => setWaitingForLog(false), 1500);
    }
  };

  // 监听任务状态变化，同步到执行块
  useEffect(() => {
    const activeTask = tasks.find(t => (t.status === 'PROCESSING' || t.status === 'PENDING'));
    if (waitingForLog && activeTask) {
      setWaitingForLog(false);
    }

    setExecutionBlocks(prevBlocks => {
      const newBlocks = [...prevBlocks];
      let changed = false;

      tasks.forEach(task => {
        const blockIndex = newBlocks.findIndex(b => b.id === task.job_id);
        // 只更新已存在的执行块（由 triggerScrape / handleAnalysisExecutionUpdate 主动创建），
        // 不自动拉入数据库里的历史任务，避免系统日志出现未执行的旧任务。
        if (blockIndex === -1) return;

        const logs: LogEntry[] = [];
        if (task.error_message) {
          task.error_message.split('\n').filter(Boolean).forEach((msg, i) => {
            logs.push({
              id: `log-${task.job_id}-${i}`,
              timestamp: new Date(),
              message: msg,
              type: inferLogType(msg),
            });
          });
        }

        const status: ExecutionStatus = task.status === 'SUCCESS' ? 'success' : task.status === 'FAILED' ? 'error' : 'running';
        const progress = status === 'success' ? 100 : (status === 'error' ? 100 : 50);

        const existing = newBlocks[blockIndex];
        if (existing.status !== status || existing.logs.length !== logs.length) {
          newBlocks[blockIndex] = { ...existing, status, logs, progress };
          changed = true;
        }
      });
      return changed ? newBlocks : prevBlocks;
    });
  }, [tasks, waitingForLog]);

  return { scraping, waitingForLog, executionBlocks, triggerScrape, handleAnalysisExecutionUpdate, clearExecutionBlocks: () => setExecutionBlocks([]) };
}
