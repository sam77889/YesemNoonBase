import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const STORAGE_KEY = 'noon-theme';

function readInitial(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* 忽略：隐私模式等 */
  }
  return 'dark';
}

// 模块级单一数据源，确保多处 ThemeToggle 实时同步
let current: Theme = readInitial();
const listeners = new Set<(t: Theme) => void>();

function applyTheme(t: Theme) {
  current = t;
  document.documentElement.setAttribute('data-theme', t);
  try {
    window.localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* 忽略 */
  }
  listeners.forEach((l) => l(t));
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(current);

  useEffect(() => {
    const listener = (t: Theme) => setThemeState(t);
    listeners.add(listener);
    // 挂载时确保 DOM 与状态一致
    document.documentElement.setAttribute('data-theme', current);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const toggle = useCallback(() => {
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggle };
}
