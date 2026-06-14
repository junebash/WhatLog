import { test, expect, describe } from "bun:test"

import { parseTags } from "./tags.ts"

describe("parseTags", () => {
  test("extracts hashtags without the leading #", () => {
    expect(parseTags("working on the thingy #ci #enablement")).toEqual(["ci", "enablement"])
  })

  test("returns an empty array when there are no tags", () => {
    expect(parseTags("just a plain message")).toEqual([])
  })

  test("de-duplicates, keeping first occurrence", () => {
    expect(parseTags("#ci then more #ci and #ci")).toEqual(["ci"])
  })

  test("ignores a bare # with no word characters", () => {
    expect(parseTags("a # b #real")).toEqual(["real"])
  })

  test("treats the message as-is — tags can sit anywhere", () => {
    expect(parseTags("#start middle #end")).toEqual(["start", "end"])
  })
})
