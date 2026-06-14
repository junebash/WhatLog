import { Result } from "@bloodyowl/boxed"
import { Temporal } from "temporal-polyfill"

import type { ResolvedEntry } from "./resolve.ts"

/**
 * A half-open instant range `[start, end)`. Day/week/month boundaries are
 * resolved in an explicit time zone (carried by the `ZonedDateTime` passed in),
 * then reduced to absolute `Instant`s so filtering is a pure instant comparison
 * with no ambient zone. Half-open avoids the "is 23:59:59.999 in the day?"
 * off-by-one — the end is the *next* boundary.
 */
export type DateRange = {
  start: Temporal.Instant
  end: Temporal.Instant
}

/** The calendar day containing `zdt`, in its own zone. */
function dayRangeOf(zdt: Temporal.ZonedDateTime): DateRange {
  const start = zdt.startOfDay()
  return { start: start.toInstant(), end: start.add({ days: 1 }).toInstant() }
}

export function todayRange(now: Temporal.ZonedDateTime): DateRange {
  return dayRangeOf(now)
}

export function yesterdayRange(now: Temporal.ZonedDateTime): DateRange {
  return dayRangeOf(now.startOfDay().subtract({ days: 1 }))
}

/** The current calendar week, Monday 00:00 (inclusive) to next Monday (exclusive). */
export function weekRange(now: Temporal.ZonedDateTime): DateRange {
  // dayOfWeek is ISO: 1 = Monday … 7 = Sunday — so the domain's Mon–Sun week
  // falls straight out, no locale assumption.
  const monday = now.startOfDay().subtract({ days: now.dayOfWeek - 1 })
  return { start: monday.toInstant(), end: monday.add({ days: 7 }).toInstant() }
}

/** The current calendar month, 1st 00:00 (inclusive) to the 1st of next month (exclusive). */
export function monthRange(now: Temporal.ZonedDateTime): DateRange {
  const first = now.startOfDay().with({ day: 1 })
  return { start: first.toInstant(), end: first.add({ months: 1 }).toInstant() }
}

/** The single calendar day `date` in `zone` (for `--date`). */
export function dayRange(date: Temporal.PlainDate, zone: string): DateRange {
  const start = date.toZonedDateTime(zone)
  return { start: start.toInstant(), end: start.add({ days: 1 }).toInstant() }
}

/** The inclusive span from `start` to `end` (both `YYYY-MM-DD`) in `zone`. */
export function rangeBetween(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate,
  zone: string,
): DateRange {
  const startZdt = start.toZonedDateTime(zone)
  const endZdt = end.toZonedDateTime(zone).add({ days: 1 })
  return { start: startZdt.toInstant(), end: endZdt.toInstant() }
}

/**
 * Parse a `YYYY-MM-DD` flag value into a `PlainDate`. `overflow: "reject"` makes
 * Temporal refuse impossible dates like `2026-02-30` instead of rolling over.
 */
export function parseIsoDate(value: string): Result<Temporal.PlainDate, Error> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return Result.Error(new Error(`invalid date "${value}" — expected YYYY-MM-DD`))
  }
  return Result.fromExecution(() => Temporal.PlainDate.from(value, { overflow: "reject" })).mapError(
    () => new Error(`invalid date "${value}" — no such calendar day`),
  )
}

export type EntryFilter = {
  range?: DateRange
  tag?: string
}

function instantOf(entry: ResolvedEntry): Temporal.Instant {
  return Temporal.Instant.from(entry.timestamp)
}

/** Combinable range + tag filter over resolved entries. */
export function filterEntries(entries: ResolvedEntry[], filter: EntryFilter): ResolvedEntry[] {
  return entries.filter((entry) => {
    if (filter.range !== undefined) {
      const at = instantOf(entry)
      if (
        Temporal.Instant.compare(at, filter.range.start) < 0 ||
        Temporal.Instant.compare(at, filter.range.end) >= 0
      ) {
        return false
      }
    }
    if (filter.tag !== undefined && !entry.tags.includes(filter.tag)) {
      return false
    }
    return true
  })
}

/** Most-recent-first ordering for display (`wl ls` is reverse-chronological). */
export function sortNewestFirst(entries: ResolvedEntry[]): ResolvedEntry[] {
  return [...entries].sort((a, b) => Temporal.Instant.compare(instantOf(b), instantOf(a)))
}
