import express from 'express';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { priorities, tasksTable, type Priority } from './schema.js';
import { and, eq, isNull, isNotNull, count, avg, ne, sql } from 'drizzle-orm';
import * as z from 'zod';
import { redis } from './redis.js';
import { getTaskCacheKey, getTaskListCacheKey, getTaskSummaryCacheKey, incrementTaskListVersion, incrementTaskVersion, invalidateTaskCache, TASK_LIST_TTL, TASK_TTL } from './cache.js';

const DB_FILE_NAME = process.env.DB_FILE_NAME;
if (!DB_FILE_NAME) {
  throw new Error('DB_FILE_NAME is not set');
}
const db = drizzle(DB_FILE_NAME);
const app = express();
app.use(express.json());
const PORT = process.env.PORT ?? 3000;

// Create a new task
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(50, { message: "Title cannot exceed 50 characters" }),
  description: z.string().max(200, { message: "Description cannot exceed 200 characters" }).optional(),
  priority: z.enum(priorities).optional(),
});

app.post('/tasks', async (req, res) => {
  const parsed = CreateTaskSchema.safeParse(req.body); // safeParse returns a result object instead of throwing an error
  if (!parsed.success) {
    return res.status(400).json({ errors: z.flattenError(parsed.error).fieldErrors });
  }

  try {
    const task: typeof tasksTable.$inferInsert = parsed.data;
    const [ createdTask ] = await db.insert(tasksTable).values(task).returning({ id: tasksTable.id });
    if (!createdTask) {
      return res.status(500).json({ error: 'Failed to create task' });
    }

    await invalidateTaskCache(createdTask.id);
    res.status(201).location(`/tasks/${createdTask.id}`).json({ message: `Task ${createdTask.id} created` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all tasks with optional filtering (priority, completed status)
const TaskFilterSchema = z.object({
  priority: z.enum(priorities).optional(),
  // Query params are strings, so we need to transform "true"/"false" to boolean
  complete: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
});

app.get('/tasks', async (req, res) => {
  const parsed = TaskFilterSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errors: z.flattenError(parsed.error).fieldErrors });
  }
  const { priority, complete } = parsed.data;

  const cacheKey = await getTaskListCacheKey({ priority, complete });
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }
  }
  catch (error) {
    console.warn('Redis GET failed: ', error);
  }

  try {
    const tasks = await db.select().from(tasksTable).where(and(
      priority ? eq(tasksTable.priority, priority) : undefined,
      complete === true ? isNotNull(tasksTable.completedAt) : undefined,
      complete === false ? isNull(tasksTable.completedAt) : undefined,
    ));

    try {
      await redis.set(cacheKey, JSON.stringify(tasks), { EX: TASK_LIST_TTL });
    }
    catch (error) {
      console.warn('Redis SET failed: ', error);
    }

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific task by ID
app.get('/tasks/:id', async (req, res) => {
  let id: number;
  try {
    id = parseId(req.params.id);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  const cacheKey = await getTaskCacheKey(id);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }
  }
  catch (error) {
    console.warn('Redis GET failed: ', error);
  }

  try {
    const [ task ] = await db.select().from(tasksTable).where(eq(tasksTable.id, id)).limit(1);
    if (!task) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
    try {
      await redis.set(cacheKey, JSON.stringify(task), { EX: TASK_TTL });
    }
    catch (error) {
      console.warn('Redis SET failed: ', error);
    }
    res.status(200).json(task);
  }
  catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a task by ID
app.delete('/tasks/:id', async (req, res) => {
  let id: number;
  try {
    id = parseId(req.params.id);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const result = await db.delete(tasksTable).where(eq(tasksTable.id, id));
    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
    await invalidateTaskCache(id);
    return res.status(200).json({ message: `Task ${id} deleted` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Partial update a task by ID
const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(50, { message: "Title cannot exceed 50 characters" }).optional(),
  description: z.string().max(200, { message: "Description cannot exceed 200 characters" }).optional(),
  priority: z.enum(priorities).optional(),

}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided",
});

app.patch('/tasks/:id', async (req, res) => {
  let id: number;
  try {
    id = parseId(req.params.id);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  const parsed = UpdateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: z.flattenError(parsed.error).fieldErrors });
  }

  try {
    const result = await db.update(tasksTable)
      .set({ ...parsed.data, updatedAt: sql`(unixepoch())` })
      .where(eq(tasksTable.id, id));

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
    await invalidateTaskCache(id);
    return res.status(200).json({ message: `Task ${id} updated` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start a task by ID
app.post('/tasks/:id/start', async (req, res) => {
  let id: number;
  try {
    id = parseId(req.params.id);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const result = await db.update(tasksTable)
      .set({ startedAt: sql`(unixepoch())` })
      .where(and(eq(tasksTable.id, id), isNull(tasksTable.startedAt)));

    if (result.rowsAffected === 0) {
      return res.status(400).json({ error: `Task ${id} already started` });
    }

    await invalidateTaskCache(id);
    return res.status(200).json({ message: `Task ${id} started` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete a task by ID
app.post('/tasks/:id/complete', async (req, res) => {
  let id: number;
  try {
    id = parseId(req.params.id);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const result = await db.update(tasksTable)
      .set({ completedAt: sql`(unixepoch())` })
      .where(and(eq(tasksTable.id, id), isNotNull(tasksTable.startedAt), isNull(tasksTable.completedAt)));

    if (result.rowsAffected === 0) {
      return res.status(400).json({ error: `Unable to complete task ${id}: not started or already completed` });
    }

    await invalidateTaskCache(id);
    return res.status(200).json({ message: `Task ${id} completed` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Return summary statistics (total tasks, completed %, average completion time in seconds)
app.get('/summary', async (req, res) => {
  const cacheKey = await getTaskSummaryCacheKey();
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }
  }
  catch (error) {
    console.warn('Redis GET failed: ', error);
  }

  try {
    const [ queries ] = await db.select({
      totalTasks: count(),
      completedTasks: sql<number>`sum(case when ${tasksTable.completedAt} is not null then 1 else 0 end)`,
      incompleteTasks: sql<number>`sum(case when ${tasksTable.completedAt} is null then 1 else 0 end)`,
      averageCompletionTimeInSeconds: sql<number>`AVG(CASE WHEN ${tasksTable.completedAt} IS NOT NULL AND ${tasksTable.startedAt} IS NOT NULL THEN ${tasksTable.completedAt} - ${tasksTable.startedAt} END)`,
    }).from(tasksTable);
    const summary = {
      ...queries,
      percentComplete: queries?.totalTasks ? (queries.completedTasks / queries.totalTasks) * 100 : 0,
    }
    try {
      await redis.set(cacheKey, JSON.stringify(summary), { EX: TASK_LIST_TTL });
    }
    catch (error) {
      console.warn('Redis SET failed: ', error);
    }

    res.status(200).json(summary);
  }
  catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

function parseId(id: string): number {
  const parsed = Number(id);
  if (isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Invalid task ID');
  }
  return parsed;
}