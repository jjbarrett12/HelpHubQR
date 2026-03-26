/** Archived entities are soft-deleted: `archived_at` set; history rows remain. */

export function isArchivedRecord(row: { archived_at?: string | null } | null | undefined): boolean {
  return row != null && row.archived_at != null && String(row.archived_at).length > 0;
}
