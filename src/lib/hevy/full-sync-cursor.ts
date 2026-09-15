/**
 * A full-sync page is replayed when any workout on that page failed. Successful
 * upserts are idempotent, so this prevents a partial page from being skipped.
 */
export function canAdvanceFullSyncPage(
  errorsBeforePage: number,
  errorsAfterPage: number,
): boolean {
  return errorsAfterPage === errorsBeforePage
}
