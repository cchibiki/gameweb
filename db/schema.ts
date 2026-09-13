// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const players=sqliteTable('players',{id:text('id').primaryKey(),tokenHash:text('token_hash').notNull().unique(),name:text('name').notNull(),updated:integer('updated').notNull()});
export const rooms=sqliteTable('rooms',{id:text('id').primaryKey(),payload:text('payload').notNull(),revision:integer('revision').notNull().default(0),updated:integer('updated').notNull()},t=>[index('idx_rooms_updated').on(t.updated)]);
