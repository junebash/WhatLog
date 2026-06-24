import type { Future, Result } from "@bloodyowl/boxed"
import type { Temporal } from "temporal-polyfill"

import { WhatLogConfig } from "./config.ts"
import { readRecords, readTextImpl } from "./storage.ts"
import type { ReadText } from "./storage.ts"
import { resolveEntries, shortestUniquePrefixes } from "./resolve.ts"
import { filterEntries, sortNewestFirst } from "./query.ts"
import type { EntryFilter } from "./query.ts"
import { renderLog } from "./render.ts"

export type ListOptions = {
  filter: EntryFilter
  /** Cap on entries shown (for plain `wl ls`); omit to show the whole result set. */
  count?: number
  color: boolean
  now: Temporal.ZonedDateTime
  hour12: boolean
}

export type ListDeps = {
  environment: Record<string, string | undefined>
  readText: ReadText
}

export const defaultListDeps: ListDeps = {
  environment: process.env,
  readText: readTextImpl,
}

/**
 * Imperative shell for the read path: read the log, fold amendments, filter,
 * order newest-first, cap to `count`, then render. Every transformation after
 * the read is a pure core (`resolveEntries`, `filterEntries`, `sortNewestFirst`,
 * `shortestUniquePrefixes`, `renderLog`). The short-id prefixes are computed
 * over the *displayed* set, per the PRD.
 */
export function listEntries(
  options: ListOptions,
  deps: ListDeps = defaultListDeps,
): Future<Result<string, Error>> {
  const path = WhatLogConfig.logFile(deps.environment)
  return readRecords(path, deps.readText).mapOk((records) => {
    const filtered = sortNewestFirst(filterEntries(resolveEntries(records), options.filter))
    const visible = options.count === undefined ? filtered : filtered.slice(0, options.count)
    const prefixes = shortestUniquePrefixes(visible.map((entry) => entry.id))
    return renderLog(visible, prefixes, {
      color: options.color,
      now: options.now,
      hour12: options.hour12,
    })
  })
}
