// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable,text,integer } from 'drizzle-orm/sqlite-core';
export const requestAudit=sqliteTable('request_audit',{id:text('id').primaryKey(),createdAt:text('created_at').notNull(),tool:text('tool').notNull(),outcome:text('outcome').notNull(),durationMs:integer('duration_ms').notNull()});
