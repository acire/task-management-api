import { redis } from "./redis.js";
import type { Priority } from "./schema.js";

export const TASK_TTL = 120;
export const TASK_LIST_TTL = 120;

export async function getTaskCacheKey(id: number) {
  const version = await redis.get(`tasks:${id}:version`) ?? "1";
  return `tasks:${id}:v${version}`;
}

export async function getTaskListCacheKey({ priority, complete }: { priority: Priority | undefined, complete: boolean | undefined }): Promise<string> {
  const version = await redis.get('tasks:list:version') ?? '1';
  const parts = [ 'tasks' ];
  if (priority === undefined && complete === undefined) {
    parts.push('all');
    return `${parts.join(':')}:v${version}`;
  }

  if (priority) {
    parts.push(`priority:${priority}`);
  }
  if (complete) {
    parts.push(`complete:${complete}`);
  }
  return `${parts.join(':')}:v${version}`;
}

export async function getTaskSummaryCacheKey(): Promise<string> {
  const version = await redis.get('tasks:list:version') ?? '1'; // using the same version as the list
  return `tasks:summary:v${version}`;
}

// Increment version key for individual tasks (like from the GET /tasks/:id endpoint)
export async function incrementTaskVersion(id: number) {
  try {
    await redis.incr(`tasks:${id}:version`);
  }
  catch (error) {
    console.warn('Redis INCR failed: ', error);
  }
}

// Increment version key for lists (like from the GET /tasks endpoint)
export async function incrementTaskListVersion() {
  try {
    await redis.incr('tasks:list:version');
  }
  catch (error) {
    console.warn('Redis INCR failed: ', error);
  }
}

export async function invalidateTaskCache(id: number) {
  await incrementTaskVersion(id);
  await incrementTaskListVersion();
}