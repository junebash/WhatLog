import type { LogRecord } from "./records.ts"

/**
 * A log is an append-only stream of `entry` / `edit` / `delete` records. A
 * `ResolvedEntry` is what one entry *currently* looks like once every later
 * amendment has been folded over it — the shape the read path actually displays.
 */
export type ResolvedEntry = {
  id: string
  timestamp: string
  message: string
  tags: string[]
}

/**
 * Functional core of the read path: fold the amendment stream into the set of
 * currently-visible entries.
 *
 * - `entry` introduces a new entry (keyed by its own `id`).
 * - `edit` overwrites the `message`/`tags` of its `targetId`, leaving the
 *   original `timestamp` (when it was logged) intact.
 * - `delete` removes its `targetId` — a tombstone, so the entry vanishes from
 *   every query view.
 *
 * Amendments that point at an unknown `targetId` are ignored rather than
 * treated as errors: the log is append-only and a stray pointer shouldn't crash
 * a read. Insertion order is preserved (a `Map` keeps it); callers sort for
 * display.
 */
export function resolveEntries(records: LogRecord[]): ResolvedEntry[] {
  const entries = new Map<string, ResolvedEntry>()

  for (const record of records) {
    switch (record.type) {
      case "entry":
        entries.set(record.id, {
          id: record.id,
          timestamp: record.timestamp,
          message: record.message,
          tags: record.tags,
        })
        break
      case "edit": {
        const existing = entries.get(record.targetId)
        if (existing !== undefined) {
          entries.set(record.targetId, {
            ...existing,
            message: record.message,
            tags: record.tags,
          })
        }
        break
      }
      case "delete":
        entries.delete(record.targetId)
        break
    }
  }

  return [...entries.values()]
}

/**
 * For each id, compute the shortest leading substring that is unique across the
 * whole set — the `jj`-style short id shown in `wl ls`. Two ids that are
 * identical (shouldn't happen for distinct entries) map to the full id.
 *
 * Pure: same input ids always yield the same prefixes.
 */
export function shortestUniquePrefixes(ids: string[]): Map<string, string> {
  const prefixes = new Map<string, string>()

  for (const id of ids) {
    let length = 1
    while (length < id.length) {
      const candidate = id.slice(0, length)
      const collides = ids.some((other) => other !== id && other.startsWith(candidate))
      if (!collides) {
        break
      }
      length += 1
    }
    prefixes.set(id, id.slice(0, length))
  }

  return prefixes
}
