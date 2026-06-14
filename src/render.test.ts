import { test, expect, describe } from "bun:test"
import { Temporal } from "temporal-polyfill"

import { relativeTime, renderLog } from "./render.ts"
import type { ResolvedEntry } from "./resolve.ts"

const ZONE = "America/New_York"
const NOW = Temporal.Instant.from("2026-06-14T16:00:00Z").toZonedDateTimeISO(ZONE)

function ago(opts: Parameters<Temporal.ZonedDateTime["subtract"]>[0]): Temporal.ZonedDateTime {
  return NOW.subtract(opts)
}

describe("relativeTime", () => {
  test("just now under a minute", () => {
    expect(relativeTime(ago({ seconds: 30 }), NOW)).toBe("just now")
  })

  test("minutes", () => {
    expect(relativeTime(ago({ minutes: 1 }), NOW)).toBe("1 minute ago")
    expect(relativeTime(ago({ minutes: 5 }), NOW)).toBe("5 minutes ago")
  })

  test("hours within the same day", () => {
    expect(relativeTime(ago({ hours: 2 }), NOW)).toBe("2 hours ago")
  })

  test("yesterday", () => {
    expect(relativeTime(ago({ days: 1 }), NOW)).toBe("yesterday")
  })

  test("days within a week", () => {
    expect(relativeTime(ago({ days: 3 }), NOW)).toBe("3 days ago")
  })

  test("falls back to an absolute date past a week", () => {
    expect(relativeTime(ago({ days: 30 }), NOW)).toBe("May 15")
  })
})

describe("renderLog", () => {
  function entry(id: string, message: string, timestamp: string, tags: string[] = []): ResolvedEntry {
    return { id, timestamp, message, tags }
  }

  test("placeholder when empty", () => {
    expect(renderLog([], new Map(), { color: false, now: NOW })).toBe("(no entries)")
  })

  test("color:false produces no ANSI escapes", () => {
    const entries = [entry("abcd", "hello #ci", "2026-06-14T15:00:00Z", ["ci"])]
    const out = renderLog(entries, new Map([["abcd", "a"]]), { color: false, now: NOW })
    // eslint-disable-next-line no-control-regex
    expect(/\x1b\[/.test(out)).toBe(false)
    expect(out).toContain("hello #ci")
    expect(out).toContain("a")
  })

  test("color:true emits ANSI escapes", () => {
    const entries = [entry("abcd", "hello #ci", "2026-06-14T15:00:00Z", ["ci"])]
    const out = renderLog(entries, new Map([["abcd", "a"]]), { color: true, now: NOW })
    // eslint-disable-next-line no-control-regex
    expect(/\x1b\[/.test(out)).toBe(true)
  })

  test("inserts a day separator per calendar day, in zone", () => {
    const entries = [
      entry("c", "today late", "2026-06-14T19:00:00Z"),
      entry("b", "today early", "2026-06-14T15:00:00Z"),
      entry("a", "yesterday", "2026-06-13T19:00:00Z"),
    ]
    const out = renderLog(entries, new Map(), { color: false, now: NOW })
    expect(out).toContain("June 14, 2026")
    expect(out).toContain("June 13, 2026")
    // Two distinct days → two separator lines (each starts with "── ").
    expect(out.split("\n").filter((line) => line.startsWith("── "))).toHaveLength(2)
  })
})
