import { test, expect, describe } from "bun:test"

import { matchPrefix } from "./prefix.ts"
import type { ResolvedEntry } from "./resolve.ts"

function entry(id: string): ResolvedEntry {
  return { id, timestamp: "2026-06-14T10:00:00.000Z", message: id, tags: [] }
}

const entries = [entry("abcd"), entry("abce"), entry("zzzz")]

describe("matchPrefix", () => {
  test("no match", () => {
    expect(matchPrefix("q", entries)).toEqual({ tag: "none" })
  })

  test("exactly one match", () => {
    const result = matchPrefix("z", entries)
    expect(result.tag).toBe("one")
    if (result.tag === "one") {
      expect(result.entry.id).toBe("zzzz")
    }
  })

  test("ambiguous match returns all candidates", () => {
    const result = matchPrefix("abc", entries)
    expect(result.tag).toBe("many")
    if (result.tag === "many") {
      expect(result.matches.map((e) => e.id)).toEqual(["abcd", "abce"])
    }
  })

  test("a full id is a single match", () => {
    const result = matchPrefix("abcd", entries)
    expect(result.tag).toBe("one")
  })

  test("an empty prefix matches nothing", () => {
    expect(matchPrefix("", entries)).toEqual({ tag: "none" })
  })
})
