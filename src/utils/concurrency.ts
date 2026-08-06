/**
 * 并发执行异步任务，限制同时在途的任务数。
 *
 * 与「分批 Promise.all」相比，本实现允许任务在完成后立即拾取下一个任务，
 * 不必等待同批最慢任务完成。
 *
 * @param tasks 任务工厂数组（每个返回 Promise；按需延迟创建以遵守并发限制）
 * @param limit 最大并发数（小于 1 时按 1 处理）
 * @returns 所有任务结果的数组（顺序与输入一致）
 */
export async function runWithConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  };

  const workerCount = Math.min(Math.max(limit, 1), tasks.length);
  const workers = Array.from({ length: workerCount }, worker);
  await Promise.all(workers);
  return results;
}
