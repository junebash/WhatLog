import { test, expect, describe } from "bun:test"
import { Future, Result } from "@bloodyowl/boxed"

import { defaultConfig, loadConfig, parseConfig } from "./config.ts"
import type { ReadText } from "./storage.ts"
import { unwrap } from "./test-utils.ts"

describe("parseConfig", () => {
  test("empty text yields defaults", () => {
    expect(unwrap(parseConfig(""))).toEqual(defaultConfig)
  })

  test("parses default_count and date_format, ignoring comments and blanks", () => {
    const text = `# my config
default_count = 50

date_format = "relative"
`
    expect(unwrap(parseConfig(text))).toEqual({ defaultCount: 50, dateFormat: "relative" })
  })

  test("ignores unknown keys for forward compatibility", () => {
    expect(unwrap(parseConfig("future_thing = 1"))).toEqual(defaultConfig)
  })

  test("rejects a non-integer default_count", () => {
    expect(parseConfig("default_count = 3.5").isError()).toBe(true)
    expect(parseConfig("default_count = -1").isError()).toBe(true)
    expect(parseConfig("default_count = nope").isError()).toBe(true)
  })

  test("rejects an unquoted date_format", () => {
    expect(parseConfig("date_format = relative").isError()).toBe(true)
  })

  test("rejects a line with no '='", () => {
    expect(parseConfig("just some words").isError()).toBe(true)
  })
})

describe("loadConfig", () => {
  test("a missing file falls back to defaults", async () => {
    const notFound: ReadText = () =>
      Future.value(Result.Error(Object.assign(new Error("missing"), { code: "ENOENT" })))
    const config = await loadConfig({}, notFound).toPromise()
    expect(unwrap(config)).toEqual(defaultConfig)
  })

  test("a present file is parsed", async () => {
    const present: ReadText = () => Future.value(Result.Ok("default_count = 7"))
    const config = await loadConfig({}, present).toPromise()
    expect(unwrap(config)).toEqual({ defaultCount: 7 })
  })

  test("a non-ENOENT read error propagates", async () => {
    const denied: ReadText = () =>
      Future.value(Result.Error(Object.assign(new Error("EACCES"), { code: "EACCES" })))
    const config = await loadConfig({}, denied).toPromise()
    expect(config.isError()).toBe(true)
  })
})
