# Task Status Display Redesign

## Objective
Update the task status display logic in both the `ScraperPage` and `FetcherPage` of the dashboard. Instead of only showing tasks that are currently running (`PROCESSING` or `PENDING`), the UI should always display the **latest single task** for that respective page, regardless of its status (`PROCESSING`, `PENDING`, `COMPLETED`, or `FAILED`).

## Design & Implementation Details

1. **Filtering Logic Update (`ScraperPage.tsx`)**:
   - Filter all tasks to get scraper tasks: `tasks.filter(t => !t.job_id?.startsWith('fetcher-'))`.
   - Take the first task from this filtered list (assuming the API returns the newest tasks first).
   - Display this single task using the `<TaskCard />` component.
   - If the list is empty (user has never initiated a task), show a placeholder message: `"暂无任务记录"`.

2. **Filtering Logic Update (`FetcherPage.tsx`)**:
   - Filter all tasks to get fetcher tasks: `tasks.filter(t => t.job_id?.startsWith('fetcher-'))`.
   - Take the first task from this filtered list.
   - Display this single task using the `<TaskCard />` component.
   - If the list is empty, show the placeholder message: `"暂无任务记录"`.

3. **Placeholder Removal**:
   - The current condition `tasks.length === 0` will be replaced with checking if the latest task exists.

## Spec Self-Review
- [x] No placeholders or vague requirements.
- [x] Internal consistency looks solid.
- [x] Scope is well-defined and small (two files to modify).
- [x] No ambiguity in requirements.
