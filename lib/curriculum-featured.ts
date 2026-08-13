/**
 * The track the console sidebar reports progress for.
 *
 * There is no per-user "active track" concept yet; when one arrives this
 * constant is what it replaces. Deliberately duplicated from
 * `prisma/seed-analyst-track.ts` rather than imported — application code
 * must not depend on seed scripts.
 *
 * Note this track ships DRAFT. `getTrackCurriculum` returns null for
 * unpublished tracks, so the sidebar progress block renders nothing until a
 * human publishes it. That is correct, not a bug.
 */
export const FEATURED_TRACK_SLUG = "analyst-interview-prep"
