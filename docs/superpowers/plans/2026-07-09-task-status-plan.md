# Task Status Display Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `ScraperPage` and `FetcherPage` to always show the single latest task regardless of its status (`PROCESSING`, `PENDING`, `COMPLETED`, or `FAILED`).

**Architecture:** Modify the filtering logic in both components. Instead of checking for `PROCESSING` or `PENDING`, we will filter by source (`fetcher-` or not), take the first item, and render it. If no items exist, we render a placeholder.

**Tech Stack:** React, TypeScript

## Global Constraints

- Must display exactly 1 latest task.
- Must show "暂无任务记录" if no tasks exist.

---

### Task 1: Update ScraperPage Logic

**Files:**
- Modify: `noon_dashboard/src/pages/ScraperPage.tsx`

**Interfaces:**
- Consumes: `tasks` array from props

- [ ] **Step 1: Write implementation**

Modify `noon_dashboard/src/pages/ScraperPage.tsx` to replace the `tasks.filter` logic.

```tsx
// Replace this:
// {tasks.filter(t => !t.job_id?.startsWith('fetcher-') && (t.status === 'PROCESSING' || t.status === 'PENDING')).map((task) => (
//   <TaskCard key={task.job_id} task={task} source="scraper" />
// ))}
// {tasks.filter(t => !t.job_id?.startsWith('fetcher-') && (t.status === 'PROCESSING' || t.status === 'PENDING')).length === 0 && (
//   <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>暂无执行中的任务</div>
// )}

// With this:
// const scraperTasks = tasks.filter(t => !t.job_id?.startsWith('fetcher-'));
// const latestScraperTask = scraperTasks[0];

// {latestScraperTask ? (
//   <TaskCard key={latestScraperTask.job_id} task={latestScraperTask} source="scraper" />
// ) : (
//   <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>暂无任务记录</div>
// )}
```
*(Make sure to put `scraperTasks` and `latestScraperTask` definition outside the return block or handle it properly inside `{}`)*

- [ ] **Step 2: Verify it compiles**

Run: `npm run build` inside `noon_dashboard`
Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd noon_dashboard
git add src/pages/ScraperPage.tsx
git commit -m "feat: display only latest task in ScraperPage"
```

---

### Task 2: Update FetcherPage Logic

**Files:**
- Modify: `noon_dashboard/src/pages/FetcherPage.tsx`

**Interfaces:**
- Consumes: `tasks` array from props

- [ ] **Step 1: Write implementation**

Modify `noon_dashboard/src/pages/FetcherPage.tsx` to replace the `tasks.filter` logic.

```tsx
// Replace this:
// {tasks.filter(t => t.job_id?.startsWith('fetcher-') && (t.status === 'PROCESSING' || t.status === 'PENDING')).map((task) => (
//   <TaskCard key={task.job_id} task={task} source="fetcher" />
// ))}
// {tasks.filter(t => t.job_id?.startsWith('fetcher-') && (t.status === 'PROCESSING' || t.status === 'PENDING')).length === 0 && (
//   <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>暂无执行中的任务</div>
// )}

// With this:
// const fetcherTasks = tasks.filter(t => t.job_id?.startsWith('fetcher-'));
// const latestFetcherTask = fetcherTasks[0];

// {latestFetcherTask ? (
//   <TaskCard key={latestFetcherTask.job_id} task={latestFetcherTask} source="fetcher" />
// ) : (
//   <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>暂无任务记录</div>
// )}
```
*(Make sure to put `fetcherTasks` and `latestFetcherTask` definition outside the return block or handle it properly inside `{}`)*

- [ ] **Step 2: Verify it compiles**

Run: `npm run build` inside `noon_dashboard`
Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd noon_dashboard
git add src/pages/FetcherPage.tsx
git commit -m "feat: display only latest task in FetcherPage"
```
