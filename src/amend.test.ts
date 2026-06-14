import { test, expect, describe } from "bun:test"
import { Future, Result } from "@bloodyowl/boxed"

import { alwaysYes, buildDelete, buildEdit, editEntry, removeEntry } from "./amend.ts"
import type { AmendDeps, Confirm } from "./amend.ts"
import type { AppendLine } from "./storage.ts"
import { toJsonLine } from "./records.ts"
import type { LogRecord } from "./records.ts"
import { unwrap, unwrapErr } from "./test-utils.ts"

describe("buildDelete / buildEdit", () => {
  test("buildDelete is a tombstone pointing at the target", () => {
    expect(buildDelete("target1", "del1", new Date("2026-06-14T16:00:00.000Z"))).toEqual({
      type: "delete",
      id: "del1",
      timestamp: "2026-06-14T16:00:00.000Z",
      targetId: "target1",
    })
  })

  test("buildEdit re-parses tags from the new message", () => {
    expect(buildEdit("target1", "fixed #now", "ed1", new Date("2026-06-14T16:00:00.000Z"))).toEqual({
      type: "edit",
      id: "ed1",
      timestamp: "2026-06-14T16:00:00.000Z",
      targetId: "target1",
      message: "fixed #now",
      tags: ["now"],
    })
  })
})

// --- shared harness: a log fixture + stubbed deps that capture appends ---

const FIXTURE: LogRecord[] = [
  { type: "entry", id: "abcd1111", timestamp: "2026-06-14T10:00:00.000Z", message: "first #ci", tags: ["ci"] },
  { type: "entry", id: "abce2222", timestamp: "2026-06-14T11:00:00.000Z", message: "second", tags: [] },
  { type: "entry", id: "ffff3333", timestamp: "2026-06-14T12:00:00.000Z", message: "third", tags: [] },
]

function makeDeps(overrides: Partial<AmendDeps> = {}): { deps: AmendDeps; writes: string[] } {
  const writes: string[] = []
  const appendLine: AppendLine = (_path, line) => {
    writes.push(line)
    return Future.value(Result.Ok(undefined))
  }
  const deps: AmendDeps = {
    environment: { WHATLOG_DATA_DIR: "/tmp/whatlog-test" },
    generateId: () => "newid000",
    now: () => new Date("2026-06-14T20:00:00.000Z"),
    readText: () => Future.value(Result.Ok(FIXTURE.map(toJsonLine).join("\n") + "\n")),
    appendLine,
    confirm: alwaysYes,
    ...overrides,
  }
  return { deps, writes }
}

describe("removeEntry", () => {
  test("appends a tombstone for the matched entry on confirm", async () => {
    const { deps, writes } = makeDeps()
    const result = await removeEntry("ff", deps).toPromise()

    expect(unwrap(result)).toMatchObject({ tag: "applied" })
    expect(writes).toHaveLength(1)
    expect(JSON.parse(writes[0] ?? "{}")).toEqual({
      type: "delete",
      id: "newid000",
      timestamp: "2026-06-14T20:00:00.000Z",
      targetId: "ffff3333",
    })
  })

  test("writes nothing and reports aborted when the user declines", async () => {
    const no: Confirm = () => Future.value(Result.Ok(false))
    const { deps, writes } = makeDeps({ confirm: no })
    const result = await removeEntry("ff", deps).toPromise()

    expect(unwrap(result)).toMatchObject({ tag: "aborted" })
    expect(writes).toHaveLength(0)
  })

  test("errors on an ambiguous prefix, listing candidates", async () => {
    const { deps, writes } = makeDeps()
    const result = await removeEntry("abc", deps).toPromise()

    expect(result.isError()).toBe(true)
    expect(unwrapErr(result).message).toContain("ambiguous")
    expect(writes).toHaveLength(0)
  })

  test("errors on a no-match prefix", async () => {
    const { deps } = makeDeps()
    const result = await removeEntry("zzzz", deps).toPromise()
    expect(result.isError()).toBe(true)
  })

  test("does not match a tombstoned entry on a later run", async () => {
    // A log where ffff3333 was already deleted: the prefix should no longer resolve.
    const withDelete = [
      ...FIXTURE,
      { type: "delete", id: "d1", timestamp: "2026-06-14T13:00:00.000Z", targetId: "ffff3333" } as LogRecord,
    ]
    const { deps } = makeDeps({
      readText: () => Future.value(Result.Ok(withDelete.map(toJsonLine).join("\n") + "\n")),
    })
    const result = await removeEntry("ff", deps).toPromise()
    expect(result.isError()).toBe(true)
  })
})

describe("editEntry", () => {
  test("appends an amendment with re-parsed tags on confirm", async () => {
    const { deps, writes } = makeDeps()
    const result = await editEntry("ffff3333", "third, fixed #done", deps).toPromise()

    expect(unwrap(result)).toMatchObject({ tag: "applied" })
    expect(JSON.parse(writes[0] ?? "{}")).toEqual({
      type: "edit",
      id: "newid000",
      timestamp: "2026-06-14T20:00:00.000Z",
      targetId: "ffff3333",
      message: "third, fixed #done",
      tags: ["done"],
    })
  })
})
