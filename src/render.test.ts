import { test, expect, describe } from "bun:test"
import { Temporal } from "temporal-polyfill"

import { formatTime, renderLog } from "./render.ts"
import type { ResolvedEntry } from "./resolve.ts"

const ZONE = "America/New_York"
const NOW = Temporal.Instant.from("2026-06-14T16:00:00Z").toZonedDateTimeISO(ZONE)

const time = (s: string) => Temporal.PlainTime.from(s)

describe("formatTime", () => {
  test("24-hour pads the hour", () => {
    expect(formatTime(time("09:05"), false)).toBe("09:05")
    expect(formatTime(time("14:30"), false)).toBe("14:30")
    expect(formatTime(time("00:00"), false)).toBe("00:00")
  })

  test("12-hour drops the leading zero and appends a period", () => {
    expect(formatTime(time("09:05"), true)).toBe("9:05 AM")
    expect(formatTime(time("13:05"), true)).toBe("1:05 PM")
  })

  test("12-hour maps midnight and noon to 12", () => {
    expect(formatTime(time("00:00"), true)).toBe("12:00 AM")
    expect(formatTime(time("12:00"), true)).toBe("12:00 PM")
  })
})

describe("renderLog", () => {
  function entry(id: string, message: string, timestamp: string, tags: string[] = []): ResolvedEntry {
    return { id, timestamp, message, tags }
  }

  test("placeholder when empty", () => {
    expect(renderLog([], new Map(), { color: false, now: NOW, hour12: false })).toBe("(no entries)")
  })

  test("color:false produces no ANSI escapes", () => {
    const entries = [entry("abcd", "hello #ci", "2026-06-14T15:00:00Z", ["ci"])]
    const out = renderLog(entries, new Map([["abcd", "a"]]), { color: false, now: NOW, hour12: false })
    // eslint-disable-next-line no-control-regex
    expect(/\x1b\[/.test(out)).toBe(false)
    expect(out).toContain("hello #ci")
    expect(out).toContain("a")
  })

  test("color:true emits ANSI escapes", () => {
    const entries = [entry("abcd", "hello #ci", "2026-06-14T15:00:00Z", ["ci"])]
    const out = renderLog(entries, new Map([["abcd", "a"]]), { color: true, now: NOW, hour12: false })
    // eslint-disable-next-line no-control-regex
    expect(/\x1b\[/.test(out)).toBe(true)
  })

  test("shows each entry's clock time, in zone, honoring hour12", () => {
    // 15:00 UTC is 11:00 in America/New_York (EDT, -04:00).
    const entries = [entry("abcd", "hello", "2026-06-14T15:00:00Z")]
    expect(renderLog(entries, new Map(), { color: false, now: NOW, hour12: false })).toContain("11:00")
    expect(renderLog(entries, new Map(), { color: false, now: NOW, hour12: true })).toContain("11:00 AM")
  })

  test("inserts a day separator per calendar day, in zone", () => {
    const entries = [
      entry("c", "today late", "2026-06-14T19:00:00Z"),
      entry("b", "today early", "2026-06-14T15:00:00Z"),
      entry("a", "yesterday", "2026-06-13T19:00:00Z"),
    ]
    const out = renderLog(entries, new Map(), { color: false, now: NOW, hour12: false })
    expect(out).toContain("June 14, 2026")
    expect(out).toContain("June 13, 2026")
    // Two distinct days → two separator lines (each starts with "── ").
    expect(out.split("\n").filter((line) => line.startsWith("── "))).toHaveLength(2)
  })
})
