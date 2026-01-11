import { int, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Without "as const", TS infers the type as 'string[]' instead of '["LOW", "MED", "HIGH"]'
export const priorities = ['LOW', 'MED', 'HIGH'] as const;
export type Priority = typeof priorities[number];

export const tasksTable = sqliteTable('tasks', {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  description: text(),
  priority: text({ enum: priorities }).default('MED'),
  createdAt: int().notNull().default(sql`(unixepoch())`),
  updatedAt: int().notNull().default(sql`(unixepoch())`),
  startedAt: int(),
  completedAt: int()
}, (table) => [
  index('idx_tasks_priority').on(table.priority),
  index('idx_tasks_startedAt').on(table.startedAt),
  index('idx_tasks_completedAt').on(table.completedAt),
])