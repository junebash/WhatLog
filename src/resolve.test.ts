import { test, expect, describe } from "bun:test"

import { resolveEntries, shortestUniquePrefixes } from "./resolve.ts"
import type { LogRecord } from "./records.ts"

function entry(id: string, message: string, tags: string[] = [], timestamp = "2026-06-14T10:00:00.000Z"): LogRecord {
  return { type: "entry", id, timestamp, message, tags }
}

describe("resolveEntries", () => {
  test("returns plain entries unchanged", () => {
    const records = [entry("a", "first", ["x"]), entry("b", "second")]
    expect(resolveEntries(records)).toEqual([
      { id: "a", timestamp: "2026-06-14T10:00:00.000Z", message: "first", tags: ["x"] },
      { id: "b", timestamp: "2026-06-14T10:00:00.000Z", message: "second", tags: [] },
    ])
  })

  test("an edit overrides message and tags but preserves the original timestamp", () => {
    const records: LogRecord[] = [
      entry("a", "before", ["old"], "2026-06-14T10:00:00.000Z"),
      { type: "edit", id: "e1", timestamp: "2026-06-14T12:00:00.000Z", targetId: "a", message: "after #new", tags: ["new"] },
    ]
    expect(resolveEntries(records)).toEqual([
      { id: "a", timestamp: "2026-06-14T10:00:00.000Z", message: "after #new", tags: ["new"] },
    ])
  })

  test("a delete tombstones its target", () => {
    const records: LogRecord[] = [
      entry("a", "keep"),
      entry("b", "remove"),
      { type: "delete", id: "d1", timestamp: "2026-06-14T12:00:00.000Z", targetId: "b" },
    ]
    expect(resolveEntries(records).map((e) => e.id)).toEqual(["a"])
  })

  test("amendments pointing at an unknown target are ignored", () => {
    const records: LogRecord[] = [
      entry("a", "only"),
      { type: "delete", id: "d1", timestamp: "t", targetId: "ghost" },
      { type: "edit", id: "e1", timestamp: "t", targetId: "ghost", message: "x", tags: [] },
    ]
    expect(resolveEntries(records).map((e) => e.id)).toEqual(["a"])
  })

  test("the last edit wins", () => {
    const records: LogRecord[] = [
      entry("a", "v1"),
      { type: "edit", id: "e1", timestamp: "t", targetId: "a", message: "v2", tags: [] },
      { type: "edit", id: "e2", timestamp: "t", targetId: "a", message: "v3", tags: [] },
    ]
    expect(resolveEntries(records)[0]?.message).toBe("v3")
  })

  test("preserves insertion order", () => {
    const records = [entry("c", "1"), entry("a", "2"), entry("b", "3")]
    expect(resolveEntries(records).map((e) => e.id)).toEqual(["c", "a", "b"])
  })
})

describe("shortestUniquePrefixes", () => {
  test("single character when ids diverge immediately", () => {
    const prefixes = shortestUniquePrefixes(["abc", "xyz"])
    expect(prefixes.get("abc")).toBe("a")
    expect(prefixes.get("xyz")).toBe("x")
  })

  test("grows the prefix until unique on shared leads", () => {
    const prefixes = shortestUniquePrefixes(["abcd", "abce", "azzz"])
    // abcd and abce share "abc", so neither can use it — both need the full id.
    expect(prefixes.get("abcd")).toBe("abcd")
    expect(prefixes.get("abce")).toBe("abce")
    // "az" already distinguishes azzz from the abc* pair.
    expect(prefixes.get("azzz")).toBe("az")
  })

  test("every prefix uniquely identifies exactly one id", () => {
    const ids = ["a3f8c2d1", "a3f8c2d9", "b1c2d3e4", "f4a5b6c7"]
    const prefixes = shortestUniquePrefixes(ids)
    for (const id of ids) {
      const prefix = prefixes.get(id) ?? id
      expect(ids.filter((other) => other.startsWith(prefix))).toEqual([id])
    }
  })

  test("a lone id gets a one-character prefix", () => {
    expect(shortestUniquePrefixes(["deadbeef"]).get("deadbeef")).toBe("d")
  })
})
