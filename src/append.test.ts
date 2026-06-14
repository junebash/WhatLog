import { test, expect, describe } from "bun:test"
import { Future, Result } from "@bloodyowl/boxed"

import { appendEntry, buildEntry } from "./append.ts"
import type { AppendEntryDeps } from "./append.ts"
import type { AppendLine } from "./storage.ts"
import { unwrap } from "./test-utils.ts"

describe("buildEntry", () => {
  test("builds an entry record with parsed tags and ISO timestamp", () => {
    const record = buildEntry("doing #ci stuff", "abcd1234", new Date("2026-06-14T16:00:00.000Z"))
    expect(record).toEqual({
      type: "entry",
      id: "abcd1234",
      timestamp: "2026-06-14T16:00:00.000Z",
      message: "doing #ci stuff",
      tags: ["ci"],
    })
  })
})

describe("appendEntry", () => {
  test("appends the serialized record to the log path and returns it", async () => {
    const writes: { path: string; line: string }[] = []
    const appendLine: AppendLine = (path, line) => {
      writes.push({ path, line })
      return Future.value(Result.Ok(undefined))
    }
    const deps: AppendEntryDeps = {
      environment: { WHATLOG_DATA_DIR: "/tmp/whatlog-test" },
      generateId: () => "abcd1234",
      now: () => new Date("2026-06-14T16:00:00.000Z"),
      appendLine,
    }

    const result = await appendEntry("hello #demo", deps).toPromise()

    expect(unwrap(result).id).toBe("abcd1234")
    expect(writes).toHaveLength(1)
    expect(writes[0]?.path).toBe("/tmp/whatlog-test/whatlog.jsonl")
    expect(JSON.parse(writes[0]?.line ?? "{}")).toEqual({
      type: "entry",
      id: "abcd1234",
      timestamp: "2026-06-14T16:00:00.000Z",
      message: "hello #demo",
      tags: ["demo"],
    })
  })

  test("propagates a write failure", async () => {
    const deps: AppendEntryDeps = {
      environment: {},
      generateId: () => "x",
      now: () => new Date(),
      appendLine: () => Future.value(Result.Error(new Error("disk full"))),
    }
    const result = await appendEntry("oops", deps).toPromise()
    expect(result.isError()).toBe(true)
  })
})
