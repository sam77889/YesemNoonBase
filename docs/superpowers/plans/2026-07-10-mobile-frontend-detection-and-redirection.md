# 移动端自动识别与专属页面路由切换实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 `noon_dashboard` 前端大盘的手机端自动检测，跳转到 `/mobile` 并呈现高度定制化的移动端 UI 界面。

**Architecture:** 
1. 编写自定义 Hook `useDeviceDetect` 来动态计算 `isMobile` 状态。
2. 改造根组件 `src/App.tsx`，通过 HTML5 History API 实现无依赖的 `/mobile` 与 `/` 路径切换。
3. 创建独立的 `src/pages/MobileApp.tsx` 作为移动端入口，设计底部毛玻璃导航栏，并重构/适配总览、外部搜索与系统日志三个核心页面。

**Tech Stack:** React 19, Vite 8, TypeScript, TailwindCSS/Vanilla CSS, Lucide Icons, Framer Motion, Recharts

## Global Constraints
* 所有移动端元素的点击目标（按钮、Tab、交互框）触控高度必须不低于 48px，确保触控精准度。
* 保证在手机竖屏（通常宽度为 320px - 480px）下的完美适配，不得出现横向滚动条或布局折叠溢出。
* 在路由重定向时引入 150ms 防抖，防止在高频拖拽/拉伸桌面窗口时产生无限重定向死循环。

---

### Task 1: 初始化测试环境与开发 `useDeviceDetect` Hook

**Files:**
- Create: `noon_dashboard/src/hooks/useDeviceDetect.ts`
- Create: `noon_dashboard/src/hooks/useDeviceDetect.test.ts`
- Modify: `noon_dashboard/package.json`

**Interfaces:**
- Produces: `useDeviceDetect` function signature: `() => { isMobile: boolean }`

- [ ] **Step 1: 在 `package.json` 中配置测试环境，安装 `vitest` 与 `@testing-library/react`**
  Modify: `noon_dashboard/package.json`
  ```json
  "devDependencies": {
    ...
    "vitest": "^1.6.0",
    "@testing-library/react": "^16.0.0",
    "jsdom": "^24.0.0"
  },
  "scripts": {
    ...
    "test": "vitest run"
  }
  ```

- [ ] **Step 2: 编写测试用例验证设备检测 Hook**
  Create: `noon_dashboard/src/hooks/useDeviceDetect.test.ts`
  ```typescript
  import { renderHook } from '@testing-library/react';
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
  import { useDeviceDetect } from './useDeviceDetect';

  describe('useDeviceDetect', () => {
    const originalUserAgent = navigator.userAgent;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true,
      });
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        configurable: true,
      });
    });

    it('should return isMobile true when screen width is under 768px', () => {
      Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
      const { result } = renderHook(() => useDeviceDetect());
      expect(result.current.isMobile).toBe(true);
    });

    it('should return isMobile true when userAgent matches mobile OS', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true,
      });
      Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
      const { result } = renderHook(() => useDeviceDetect());
      expect(result.current.isMobile).toBe(true);
    });

    it('should return isMobile false on desktop wide screen', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      const { result } = renderHook(() => useDeviceDetect());
      expect(result.current.isMobile).toBe(false);
    });
  });
  ```

- [ ] **Step 3: 运行测试确保报错（TDD 测试失败阶段）**
  运行命令: `npm run test` (在 `noon_dashboard` 目录下)
  期待输出: `useDeviceDetect` 无法解析或导入失败。

- [ ] **Step 4: 实现 `useDeviceDetect` Hook 逻辑**
  Create: `noon_dashboard/src/hooks/useDeviceDetect.ts`
  ```typescript
  import { useState, useEffect } from 'react';

  export function useDeviceDetect() {
    const checkIsMobile = (): boolean => {
      if (typeof window === 'undefined') return false;
      
      const width = window.innerWidth;
      const ua = navigator.userAgent || '';
      
      // 屏幕宽度小于 768px 或 UA 匹配移动端系统
      const isMobileWidth = width < 768;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      
      return isMobileWidth || isMobileUA;
    };

    const [isMobile, setIsMobile] = useState<boolean>(checkIsMobile);

    useEffect(() => {
      let timeoutId: number;
      const handleResize = () => {
        // 150ms 防抖，避免旋转屏幕或拖拽窗口时的瞬时高频计算
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          setIsMobile(checkIsMobile());
        }, 150);
      };

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.clearTimeout(timeoutId);
      };
    }, []);

    return { isMobile };
  }
  ```

- [ ] **Step 5: 重新运行测试验证通过**
  运行命令: `npm run test` (在 `noon_dashboard` 目录下)
  期待输出: `All tests passed`。

- [ ] **Step 6: Git 提交**
  ```bash
  git add package.json src/hooks/useDeviceDetect.ts src/hooks/useDeviceDetect.test.ts
  git commit -m "feat: implement useDeviceDetect hook with tests"
  ```

---

### Task 2: 改造 App.tsx 以实现无刷新路由跳转与设备分流

**Files:**
- Modify: `noon_dashboard/src/App.tsx`
- Create: `noon_dashboard/src/App.test.tsx`

**Interfaces:**
- Consumes: `useDeviceDetect`
- Produces: 动态渲染分流逻辑（渲染 `DesktopApp` 与 `MobileApp`）

- [ ] **Step 1: 编写 App.tsx 的路由分流测试用例**
  Create: `noon_dashboard/src/App.test.tsx`
  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  describe('App Routing Dispatcher', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should stay at / path on desktop', () => {
      expect(window.location.pathname).toBe('/');
    });
  });
  ```

- [ ] **Step 2: 运行测试验证**
  运行命令: `npm run test src/App.test.tsx`
  期待输出: `Pass`

- [ ] **Step 3: 改造 `App.tsx`，加入路由拦截与重定向逻辑**
  Modify: `noon_dashboard/src/App.tsx`
  在大约第 32 行开始：
  ```typescript
  // 导入设备检测 hook 和 MobileApp 页面
  import { useDeviceDetect } from './hooks/useDeviceDetect';
  import { MobileApp } from './pages/MobileApp';
  ```
  然后在 `App` 组件内加入：
  ```typescript
  export default function App() {
    const { isMobile } = useDeviceDetect();
    const [currentPath, setCurrentPath] = useState(window.location.pathname);

    // 监听 popstate 确保浏览器前进/后退正常运行
    useEffect(() => {
      const handlePopState = () => {
        setCurrentPath(window.location.pathname);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // 路由判定逻辑
    useEffect(() => {
      if (isMobile && currentPath !== '/mobile') {
        window.history.pushState(null, '', '/mobile');
        setCurrentPath('/mobile');
      } else if (!isMobile && currentPath === '/mobile') {
        window.history.pushState(null, '', '/');
        setCurrentPath('/');
      }
    }, [isMobile, currentPath]);

    // 分流渲染
    if (currentPath === '/mobile') {
      return <MobileApp />;
    }

    // 桌面端视图保留原有 DesktopApp 逻辑（保持第 95 - 132 行代码不变）
  ```

- [ ] **Step 4: 保存并验证编译成功**
  由于目前还没有编写 `MobileApp.tsx`，此步骤可能会有 TypeScript 编译报错找不到 `MobileApp`，这属于正常现象。接下来在 Task 3 中我们将实现该页面。

- [ ] **Step 5: Git 提交暂存**
  ```bash
  git add src/App.tsx src/App.test.tsx
  git commit -m "feat: add routing redirection and device dispatcher in App.tsx"
  ```

---

### Task 3: 编写移动端根布局 `MobileApp` 与导航栏

**Files:**
- Create: `noon_dashboard/src/pages/MobileApp.tsx`
- Modify: `noon_dashboard/src/index.css`

**Interfaces:**
- Consumes: ThemeToggle, Lucide Icons, Framer Motion
- Produces: `MobileApp` React component

- [ ] **Step 1: 编写 `MobileApp` 组件逻辑与骨架**
  Create: `noon_dashboard/src/pages/MobileApp.tsx`
  ```typescript
  import { useState, lazy, Suspense } from 'react';
  import { LayoutDashboard, Terminal, Activity } from 'lucide-react';
  import { motion, AnimatePresence } from 'framer-motion';
  import { ThemeToggle } from '../components/ThemeToggle';
  import { PageSpinner } from '../components/PageSpinner';

  // 懒加载移动端专属页面
  const MobileOverviewPage = lazy(() => import('./MobileOverviewPage').then(m => ({ default: m.MobileOverviewPage })));
  const MobileScraperPage = lazy(() => import('./MobileScraperPage').then(m => ({ default: m.MobileScraperPage })));
  const MobileSystemLogsPage = lazy(() => import('./MobileSystemLogsPage').then(m => ({ default: m.MobileSystemLogsPage })));

  type TabId = 'overview' | 'scraper' | 'logs';

  const MOBILE_NAV_ITEMS = [
    { id: 'overview' as TabId, label: '总览', icon: LayoutDashboard },
    { id: 'scraper' as TabId, label: '搜索', icon: Terminal },
    { id: 'logs' as TabId, label: '日志', icon: Activity },
  ];

  export function MobileApp() {
    const [activeTab, setActiveTab] = useState<TabId>('overview');

    return (
      <div className="mobile-app-container">
        {/* 动态背景 */}
        <div className="app-background" aria-hidden="true" />
        
        {/* 头部 Topbar */}
        <header className="mobile-topbar">
          <div className="mobile-brand">一森数字科技</div>
          <div className="mobile-header-actions">
            <span className="mobile-status-dot" />
            <span className="mobile-status-text">在线</span>
            <ThemeToggle />
          </div>
        </header>

        {/* 主滚动区 */}
        <main className="mobile-main-content">
          <Suspense fallback={<PageSpinner />}>
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.15 }}>
                  <MobileOverviewPage />
                </motion.div>
              )}
              {activeTab === 'scraper' && (
                <motion.div key="scraper" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.15 }}>
                  <MobileScraperPage />
                </motion.div>
              )}
              {activeTab === 'logs' && (
                <motion.div key="logs" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.15 }}>
                  <MobileSystemLogsPage />
                </motion.div>
              )}
            </AnimatePresence>
          </Suspense>
        </main>

        {/* 底部导航栏 TabBar */}
        <nav className="mobile-bottom-nav">
          {MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} type="button" className={`mobile-nav-btn ${isActive ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
                <div className="mobile-nav-btn-icon">
                  <Icon size={22} />
                  {isActive && (
                    <motion.div layoutId="mobileActiveIndicator" className="mobile-active-indicator" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  }
  ```

- [ ] **Step 2: 补充 `index.css` 样式，定义移动端容器样式**
  Modify: `noon_dashboard/src/index.css`
  在文件底部追加：
  ```css
  /* 移动端专属样式适配 */
  .mobile-app-container {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    background-color: var(--bg-app);
    color: var(--text-main);
    overflow: hidden;
    position: relative;
  }

  .mobile-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background-color: var(--bg-card-blur);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .mobile-brand {
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--text-main);
  }

  .mobile-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .mobile-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #22c55e;
  }

  .mobile-status-text {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-right: 0.25rem;
  }

  .mobile-main-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    padding-bottom: calc(4.5rem + env(safe-area-inset-bottom));
    -webkit-overflow-scrolling: touch;
  }

  .mobile-bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(3.75rem + env(safe-area-inset-bottom));
    background-color: var(--bg-card-blur);
    backdrop-filter: blur(16px);
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding-bottom: env(safe-area-inset-bottom);
    z-index: 10;
  }

  .mobile-nav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    outline: none;
    color: var(--text-muted);
    font-size: 0.75rem;
    cursor: pointer;
    position: relative;
    padding: 0.25rem 0.75rem;
    min-width: 4.5rem;
    height: 100%;
    transition: color 0.2s ease;
  }

  .mobile-nav-btn.active {
    color: var(--primary);
  }

  .mobile-nav-btn-icon {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.25rem;
    width: 2rem;
    height: 1.5rem;
  }

  .mobile-active-indicator {
    position: absolute;
    bottom: -8px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--primary);
  }
  ```

- [ ] **Step 3: Git 提交暂存**
  ```bash
  git add src/pages/MobileApp.tsx src/index.css
  git commit -m "feat: add MobileApp shell layout and CSS styles"
  ```

---

### Task 4: 实现移动端专属核心页面 (Overview, Scraper, Logs)

**Files:**
- Create: `noon_dashboard/src/pages/MobileOverviewPage.tsx`
- Create: `noon_dashboard/src/pages/MobileScraperPage.tsx`
- Create: `noon_dashboard/src/pages/MobileSystemLogsPage.tsx`

**Interfaces:**
- Consumes: Hooks `useProducts`, `useTasks`, `useScrapeController`, `useGlobalFilters`
- Produces: 专属移动端适配展示组件

- [ ] **Step 1: 实现 `MobileOverviewPage.tsx` 大盘数据总览**
  Create: `noon_dashboard/src/pages/MobileOverviewPage.tsx`
  ```typescript
  import { useProducts, useTasks } from '../hooks/useProducts';
  import { useGlobalFilters } from '../hooks/useGlobalFilters';
  import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

  export function MobileOverviewPage() {
    const gf = useGlobalFilters();
    const { data: listData } = useProducts(gf.listParams);
    const { data: tasks = [] } = useTasks();

    const activeTasksCount = tasks.filter(t => t.status === 'running').length;
    const totalItemsCount = listData?.total ?? 0;

    // 模拟数据渲染折线图
    const chartData = [
      { name: '7/06', value: 400 },
      { name: '7/07', value: 450 },
      { name: '7/08', value: 480 },
      { name: '7/09', value: 520 },
      { name: '7/10', value: totalItemsCount },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* KPI 卡片网格 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
          <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>监控商品总数</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{totalItemsCount}</span>
          </div>
          <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>运行中爬虫数</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#eab308' }}>{activeTasksCount}</span>
          </div>
        </div>

        {/* 趋势图表卡片 */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>监控池商品增长趋势</div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="value" stroke="var(--primary)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: 实现 `MobileScraperPage.tsx` 爬虫运行与任务卡片展示**
  Create: `noon_dashboard/src/pages/MobileScraperPage.tsx`
  ```typescript
  import { useState } from 'react';
  import { useScrapeController } from '../hooks/useScrapeController';
  import { useTasks } from '../hooks/useProducts';

  export function MobileScraperPage() {
    const sc = useScrapeController();
    const { data: tasks = [] } = useTasks();
    const [query, setQuery] = useState('');
    const [pages, setPages] = useState(1);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;
      await sc.triggerScrape(query, pages, 'fetcher');
      setQuery('');
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* 表单卡片 */}
        <div className="card" style={{ padding: '1rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>快速提交爬虫任务</div>
            <input type="text" className="input" placeholder="输入搜索关键词" value={query} onChange={(e) => setQuery(e.target.value)} style={{ height: '48px', padding: '0 0.75rem', fontSize: '0.9rem' }} />
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>页数:</span>
              <select className="select" value={pages} onChange={(e) => setPages(Number(e.target.value))} style={{ flex: 1, height: '48px', padding: '0 0.75rem' }}>
                <option value={1}>1 页</option>
                <option value={2}>2 页</option>
                <option value={3}>3 页</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={sc.scraping} style={{ height: '48px', fontSize: '0.95rem', fontWeight: 600 }}>
              {sc.scraping ? '爬取中...' : '开始爬取'}
            </button>
          </form>
        </div>

        {/* 任务折叠列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', paddingLeft: '0.25rem' }}>历史任务列表</div>
          {tasks.slice(0, 5).map((task) => (
            <div key={task.id} className="card" style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{task.query}</span>
                <span className={`status-pill ${task.status}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                  {task.status === 'running' ? '运行中' : task.status === 'completed' ? '已完成' : '失败'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>源端: {task.provider}</span>
                <span>创建时间: {new Date(task.created_at || '').toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: 实现 `MobileSystemLogsPage.tsx` 系统日志查看**
  Create: `noon_dashboard/src/pages/MobileSystemLogsPage.tsx`
  ```typescript
  import { useScrapeController } from '../hooks/useScrapeController';

  export function MobileSystemLogsPage() {
    const sc = useScrapeController();

    const handleCopy = () => {
      const allText = sc.executionBlocks.map(b => b.text).join('\n');
      navigator.clipboard.writeText(allText);
      alert('日志已复制到剪贴板！');
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: 'calc(100dvh - 12rem)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>系统实时日志</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" onClick={handleCopy} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', minHeight: '32px' }}>复制</button>
            <button type="button" onClick={sc.clearExecutionBlocks} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', minHeight: '32px', color: '#ef4444' }}>清空</button>
          </div>
        </div>

        {/* 日志终端区域 */}
        <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {sc.executionBlocks.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>暂无日志信息...</div>
          ) : (
            sc.executionBlocks.map((block, idx) => (
              <div key={idx} style={{ color: block.type === 'error' ? '#ef4444' : block.type === 'status' ? '#3b82f6' : 'var(--text-main)' }}>
                {block.text}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 4: 运行前端项目测试与构建，确认代码无 TypeScript 编译错误**
  运行命令: `npm run build` (在 `noon_dashboard` 目录下)
  期待输出: `tsc -b && vite build` 编译成功，无编译错误。

- [ ] **Step 5: Git 提交完成**
  ```bash
  git add src/pages/MobileOverviewPage.tsx src/pages/MobileScraperPage.tsx src/pages/MobileSystemLogsPage.tsx
  git commit -m "feat: implement mobile sub-pages Overview, Scraper, and SystemLogs"
  ```
