/**
 * Tag normalization rule shared across every surface that writes
 * `Bill.tags`. Today only `TagsButton` calls it; future surfaces (AI
 * extraction, search filters) should use the same helper so the
 * canonical form (lowercase, trimmed) stays consistent.
 */

export const MAX_TAGS_PER_BILL = 10;
export const MAX_TAG_LENGTH = 24;

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase();
}
