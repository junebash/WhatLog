import { test, expect, describe } from "bun:test"

import { parseRecord, parseLine, toJsonLine } from "./records.ts"
import type { LogRecord } from "./records.ts"
import { unwrap } from "./test-utils.ts"

describe("parseRecord", () => {
  test("accepts a valid entry", () => {
    const value = {
      type: "entry",
      id: "a3f8c2d1",
      timestamp: "2026-06-13T18:42:00.000Z",
      message: "hi #ci",
      tags: ["ci"],
    }
    expect(unwrap(parseRecord(value))).toEqual(value as LogRecord)
  })

  test("accepts a valid edit", () => {
    const value = {
      type: "edit",
      id: "c3d4e5f6",
      timestamp: "2026-06-13T20:05:00.000Z",
      targetId: "a3f8c2d1",
      message: "fixed",
      tags: [],
    }
    expect(unwrap(parseRecord(value))).toEqual(value as LogRecord)
  })

  test("accepts a valid delete", () => {
    const value = {
      type: "delete",
      id: "b1c2d3e4",
      timestamp: "2026-06-13T20:00:00.000Z",
      targetId: "a3f8c2d1",
    }
    expect(unwrap(parseRecord(value))).toEqual(value as LogRecord)
  })

  test("rejects a non-object", () => {
    expect(parseRecord(42).isError()).toBe(true)
  })

  test("rejects a missing id", () => {
    expect(parseRecord({ type: "entry", timestamp: "t", message: "m", tags: [] }).isError()).toBe(true)
  })

  test("rejects a non-string timestamp", () => {
    expect(parseRecord({ type: "entry", id: "x", timestamp: 1, message: "m", tags: [] }).isError()).toBe(true)
  })

  test("rejects an entry whose tags are not all strings", () => {
    const bad = { type: "entry", id: "x", timestamp: "t", message: "m", tags: ["ok", 1] }
    expect(parseRecord(bad).isError()).toBe(true)
  })

  test("rejects an edit without a targetId", () => {
    const bad = { type: "edit", id: "x", timestamp: "t", message: "m", tags: [] }
    expect(parseRecord(bad).isError()).toBe(true)
  })

  test("rejects an unknown type", () => {
    expect(parseRecord({ type: "frobnicate", id: "x", timestamp: "t" }).isError()).toBe(true)
  })
})

describe("parseLine", () => {
  test("rejects malformed JSON", () => {
    expect(parseLine("{not json").isError()).toBe(true)
  })

  test("round-trips with toJsonLine", () => {
    const record: LogRecord = {
      type: "entry",
      id: "a3f8c2d1",
      timestamp: "2026-06-13T18:42:00.000Z",
      message: "round #trip",
      tags: ["trip"],
    }
    expect(unwrap(parseLine(toJsonLine(record)))).toEqual(record)
  })
})
