/* Which row a camera-counted set goes into (spec §2.5): the first working set not done yet.
 * -1 means every working set is done, so the caller adds one — the count is never dropped. */
import { isWarmupRow } from '../workout-model.js'

export function pickSetToLog(sets = []) {
  return sets.findIndex(s => !isWarmupRow(s) && !s.done)
}
