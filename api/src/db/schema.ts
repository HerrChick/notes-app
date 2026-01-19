import { integer, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    usernameUnique: uniqueIndex('users_username_unique').on(t.username),
  }),
)

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(), // uuid
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    userIdIdx: index('sessions_user_id_idx').on(t.userId),
    expiresIdx: index('sessions_expires_at_idx').on(t.expiresAt),
  }),
)

export const dailyNotes = sqliteTable(
  'daily_notes',
  {
    date: text('date').primaryKey(), // YYYY-MM-DD
    markdown: text('markdown').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    updatedIdx: index('daily_notes_updated_at_idx').on(t.updatedAt),
  }),
)

export const topics = sqliteTable('topics', {
  name: text('name').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

export const todos = sqliteTable(
  'todos',
  {
    id: text('id').primaryKey(), // uuid (also embedded into markdown)
    dailyDate: text('daily_date').notNull(), // YYYY-MM-DD
    title: text('title').notNull(),
    status: text('status').notNull(), // 'open' | 'done'
    dueAt: integer('due_at', { mode: 'timestamp_ms' }),
    topicName: text('topic_name'),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    dailyIdx: index('todos_daily_date_idx').on(t.dailyDate),
    statusIdx: index('todos_status_idx').on(t.status),
    dueIdx: index('todos_due_at_idx').on(t.dueAt),
    topicIdx: index('todos_topic_name_idx').on(t.topicName),
  }),
)

export const todoNotes = sqliteTable('todo_notes', {
  todoId: text('todo_id')
    .primaryKey()
    .references(() => todos.id, { onDelete: 'cascade' }),
  markdown: text('markdown').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const topicEntries = sqliteTable(
  'topic_entries',
  {
    id: text('id').primaryKey(), // uuid
    topicName: text('topic_name')
      .notNull()
      .references(() => topics.name, { onDelete: 'cascade' }),
    dailyDate: text('daily_date').notNull(), // YYYY-MM-DD
    contentMarkdown: text('content_markdown').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    topicIdx: index('topic_entries_topic_name_idx').on(t.topicName),
    dailyIdx: index('topic_entries_daily_date_idx').on(t.dailyDate),
    topicDailyIdx: index('topic_entries_topic_daily_idx').on(t.topicName, t.dailyDate),
  }),
)

