import { test, expect, describe } from "bun:test"
import { Temporal } from "temporal-polyfill"

import {
  dayRange,
  filterEntries,
  monthRange,
  parseIsoDate,
  rangeBetween,
  sortNewestFirst,
  todayRange,
  weekRange,
  yesterdayRange,
} from "./query.ts"
import type { ResolvedEntry } from "./resolve.ts"
import { unwrap } from "./test-utils.ts"

const ZONE = "America/New_York"

/** A fixed "now": Sunday June 14 2026, noon EDT (16:00Z). */
const NOW = Temporal.Instant.from("2026-06-14T16:00:00Z").toZonedDateTimeISO(ZONE)

function instant(iso: string): Temporal.Instant {
  return Temporal.Instant.from(iso)
}

function expectInstant(actual: Temporal.Instant, expectedIso: string): void {
  expect(Temporal.Instant.compare(actual, instant(expectedIso))).toBe(0)
}

describe("date ranges (zone-explicit)", () => {
  test("todayRange spans the local calendar day", () => {
    const range = todayRange(NOW)
    // June 14 00:00 EDT == 04:00Z; next midnight is June 15 04:00Z.
    expectInstant(range.start, "2026-06-14T04:00:00Z")
    expectInstant(range.end, "2026-06-15T04:00:00Z")
  })

  test("yesterdayRange is the prior calendar day", () => {
    const range = yesterdayRange(NOW)
    expectInstant(range.start, "2026-06-13T04:00:00Z")
    expectInstant(range.end, "2026-06-14T04:00:00Z")
  })

  test("weekRange runs Monday 00:00 to the next Monday", () => {
    // Sunday June 14 belongs to the week starting Monday June 8.
    const range = weekRange(NOW)
    expectInstant(range.start, "2026-06-08T04:00:00Z")
    expectInstant(range.end, "2026-06-15T04:00:00Z")
  })

  test("monthRange runs the 1st to the 1st of next month", () => {
    const range = monthRange(NOW)
    expectInstant(range.start, "2026-06-01T04:00:00Z")
    expectInstant(range.end, "2026-07-01T04:00:00Z")
  })

  test("dayRange for an explicit PlainDate uses the given zone", () => {
    const range = dayRange(Temporal.PlainDate.from("2026-06-14"), ZONE)
    expectInstant(range.start, "2026-06-14T04:00:00Z")
    expectInstant(range.end, "2026-06-15T04:00:00Z")
  })

  test("rangeBetween includes the end date in full", () => {
    const range = rangeBetween(
      Temporal.PlainDate.from("2026-06-10"),
      Temporal.PlainDate.from("2026-06-12"),
      ZONE,
    )
    expectInstant(range.start, "2026-06-10T04:00:00Z")
    // end is exclusive midnight after June 12 → June 13 04:00Z.
    expectInstant(range.end, "2026-06-13T04:00:00Z")
  })

  test("handles a DST spring-forward day as 23 hours (Temporal earns its keep)", () => {
    // 2026-03-08 is the US spring-forward day: clocks jump 02:00 → 03:00 EST→EDT.
    const range = dayRange(Temporal.PlainDate.from("2026-03-08"), ZONE)
    const hours = range.end.epochMilliseconds - range.start.epochMilliseconds
    expect(hours / (60 * 60 * 1000)).toBe(23)
  })
})

describe("parseIsoDate", () => {
  test("parses a valid date", () => {
    expect(unwrap(parseIsoDate("2026-06-14")).toString()).toBe("2026-06-14")
  })

  test("rejects a wrong shape", () => {
    expect(parseIsoDate("June 14").isError()).toBe(true)
    expect(parseIsoDate("2026-6-1").isError()).toBe(true)
  })

  test("rejects an impossible calendar day", () => {
    expect(parseIsoDate("2026-02-30").isError()).toBe(true)
    expect(parseIsoDate("2026-13-01").isError()).toBe(true)
  })
})

describe("filterEntries & sortNewestFirst", () => {
  function entry(id: string, timestamp: string, tags: string[] = []): ResolvedEntry {
    return { id, timestamp, message: id, tags }
  }

  const entries = [
    entry("a", "2026-06-13T18:00:00Z", ["ci"]),
    entry("b", "2026-06-14T18:00:00Z", ["demo"]),
    entry("c", "2026-06-14T19:00:00Z", ["ci", "demo"]),
  ]

  test("filters by range (today, in zone)", () => {
    const result = filterEntries(entries, { range: todayRange(NOW) })
    expect(result.map((e) => e.id)).toEqual(["b", "c"])
  })

  test("filters by tag", () => {
    expect(filterEntries(entries, { tag: "ci" }).map((e) => e.id)).toEqual(["a", "c"])
  })

  test("combines range and tag", () => {
    const result = filterEntries(entries, { range: todayRange(NOW), tag: "ci" })
    expect(result.map((e) => e.id)).toEqual(["c"])
  })

  test("sortNewestFirst orders by timestamp descending", () => {
    expect(sortNewestFirst(entries).map((e) => e.id)).toEqual(["c", "b", "a"])
  })

  test("sortNewestFirst does not mutate its input", () => {
    const copy = [...entries]
    sortNewestFirst(entries)
    expect(entries).toEqual(copy)
  })
})
