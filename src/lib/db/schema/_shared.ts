import { sql, type SQL } from "drizzle-orm";
import { pgPolicy, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

export const id = () => uuid("id").primaryKey().defaultRandom();

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** FK to auth.users, deleted with the account (right to erasure). */
export const userId = () =>
  uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" });

const isOwner = (column: AnyPgColumn): SQL => sql`${column} = ${authUid}`;

/**
 * Owner can only READ the row. Writes go through the server (privileged connection)
 * so that statistics, quotas and entitlements cannot be forged through the Data API.
 */
export const ownerReadOnly = (table: string, column: AnyPgColumn) => [
  pgPolicy(`${table}_owner_select`, {
    for: "select",
    to: authenticatedRole,
    using: isOwner(column),
  }),
];

/** Owner can fully manage the row (user-editable data only: preferences, interests…). */
export const ownerReadWrite = (table: string, column: AnyPgColumn) => [
  ...ownerReadOnly(table, column),
  pgPolicy(`${table}_owner_insert`, {
    for: "insert",
    to: authenticatedRole,
    withCheck: isOwner(column),
  }),
  pgPolicy(`${table}_owner_update`, {
    for: "update",
    to: authenticatedRole,
    using: isOwner(column),
    withCheck: isOwner(column),
  }),
  pgPolicy(`${table}_owner_delete`, {
    for: "delete",
    to: authenticatedRole,
    using: isOwner(column),
  }),
];

/** Reference data readable by everyone (anon + authenticated), written by the server only. */
export const publicRead = (table: string) => [
  pgPolicy(`${table}_public_select`, { for: "select", to: "public", using: sql`true` }),
];
