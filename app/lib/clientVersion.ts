/**
 * Which build of the app's own code this bundle is, as a plain counter.
 *
 * Bump it whenever a change MUST reach everyone before it is safe to rely on
 * — anything that changes how the draft is run, most of all. Cosmetic changes
 * don't need a bump.
 *
 * Why a counter and not the update id: update ids are random, so two apps
 * can't tell which of them is newer. This can be compared.
 *
 * History:
 *   1  the hand-set 28-slot draft order, and this check itself
 */
export const CLIENT_VERSION = 1;
