import { Future, Result } from "@bloodyowl/boxed"

import { WhatLogConfig } from "./config.ts"
import { toError } from "./errors.ts"
import { parseTags } from "./tags.ts"
import { toJsonLine } from "./records.ts"
import type { DeleteRecord, EditRecord, LogRecord } from "./records.ts"
import { generateIdImpl } from "./ids.ts"
import type { GenerateId } from "./ids.ts"
import { appendLineImpl, readRecords, readTextImpl } from "./storage.ts"
import type { AppendLine, ReadText } from "./storage.ts"
import { resolveEntries, shortestUniquePrefixes } from "./resolve.ts"
import type { ResolvedEntry } from "./resolve.ts"
import { matchPrefix } from "./prefix.ts"

/**
 * Asking the user "y/N?" is a side effect (it reads stdin), so it's an
 * injectable capability like every other I/O seam. Production reads a line;
 * `--yes` and tests inject a stub. This is what reconciles the PRD's confirm
 * prompt with its "non-interactive" non-goal: the prompt is real, but it's
 * swappable.
 */
export type Confirm = (question: string) => Future<Result<boolean, Error>>

export const confirmImpl: Confirm = (question) =>
  Future.value(
    Result.fromExecution(() => {
      const answer = prompt(`${question} [y/N]`) ?? ""
      return /^y(es)?$/i.test(answer.trim())
    }).mapError(toError),
  )

/** A confirm that always says yes — wired in by the `--yes`/`-y` flag. */
export const alwaysYes: Confirm = () => Future.value(Result.Ok(true))

// --- functional cores: build the amendment record (pure, like buildEntry) ---

export function buildDelete(targetId: string, id: string, timestamp: Date): DeleteRecord {
  return { type: "delete", id, timestamp: timestamp.toISOString(), targetId }
}

export function buildEdit(
  targetId: string,
  message: string,
  id: string,
  timestamp: Date,
): EditRecord {
  return {
    type: "edit",
    id,
    timestamp: timestamp.toISOString(),
    targetId,
    message,
    tags: parseTags(message),
  }
}

/**
 * The result of an amendment command: either it was applied (record appended),
 * or the user declined at the prompt. "No match" / "ambiguous prefix" are
 * surfaced through the `Error` channel instead.
 */
export type AmendOutcome =
  | { tag: "applied"; entry: ResolvedEntry; record: LogRecord }
  | { tag: "aborted"; entry: ResolvedEntry }

export type AmendDeps = {
  environment: Record<string, string | undefined>
  generateId: GenerateId
  now: () => Date
  readText: ReadText
  appendLine: AppendLine
  confirm: Confirm
}

export const defaultAmendDeps: AmendDeps = {
  environment: process.env,
  generateId: generateIdImpl,
  now: () => new Date(),
  readText: readTextImpl,
  appendLine: appendLineImpl,
  confirm: confirmImpl,
}

/** Render one matched entry for the confirmation prompt. */
function describe(entry: ResolvedEntry): string {
  return `${entry.id}  ${entry.message}`
}

/**
 * Resolve an id prefix against the current (non-tombstoned) entries. A miss or
 * an ambiguous prefix becomes a descriptive `Error`; an ambiguous prefix lists
 * every candidate's short id so the user knows what to type next.
 */
function findOne(prefix: string, entries: ResolvedEntry[]): Result<ResolvedEntry, Error> {
  const match = matchPrefix(prefix, entries)
  switch (match.tag) {
    case "one":
      return Result.Ok(match.entry)
    case "none":
      return Result.Error(new Error(`no entry matches "${prefix}"`))
    case "many": {
      const prefixes = shortestUniquePrefixes(entries.map((entry) => entry.id))
      const candidates = match.matches
        .map((entry) => prefixes.get(entry.id) ?? entry.id)
        .join(", ")
      return Result.Error(new Error(`"${prefix}" is ambiguous — matches: ${candidates}`))
    }
  }
}

/**
 * Shared shell for `rm` and `edit`: read the log, resolve entries, find the one
 * matching `prefix`, ask to confirm, and on a yes append the record built by
 * `buildRecord`. Imperative shell — all the side effects live here; the cores it
 * calls (`resolveEntries`, `matchPrefix`, `build*`) stay pure.
 */
function amend(
  prefix: string,
  action: string,
  buildRecord: (entry: ResolvedEntry, deps: AmendDeps) => LogRecord,
  deps: AmendDeps,
): Future<Result<AmendOutcome, Error>> {
  const path = WhatLogConfig.logFile(deps.environment)
  return readRecords(path, deps.readText).flatMapOk((records) =>
    findOne(prefix, resolveEntries(records)).match({
      Error: (error): Future<Result<AmendOutcome, Error>> => Future.value(Result.Error(error)),
      Ok: (entry) =>
        deps
          .confirm(`${action} ${describe(entry)}?`)
          .flatMapOk((confirmed): Future<Result<AmendOutcome, Error>> => {
            if (!confirmed) {
              return Future.value(Result.Ok({ tag: "aborted", entry }))
            }
            const record = buildRecord(entry, deps)
            return deps
              .appendLine(path, toJsonLine(record))
              .mapOk((): AmendOutcome => ({ tag: "applied", entry, record }))
          }),
    }),
  )
}

/** `wl rm <id-prefix>` — append a tombstone after confirmation. */
export function removeEntry(
  prefix: string,
  deps: AmendDeps = defaultAmendDeps,
): Future<Result<AmendOutcome, Error>> {
  return amend(
    prefix,
    "delete",
    (entry, d) => buildDelete(entry.id, d.generateId(), d.now()),
    deps,
  )
}

/** `wl edit <id-prefix> "<new message>"` — append an amendment after confirmation. */
export function editEntry(
  prefix: string,
  message: string,
  deps: AmendDeps = defaultAmendDeps,
): Future<Result<AmendOutcome, Error>> {
  return amend(
    prefix,
    "edit",
    (entry, d) => buildEdit(entry.id, message, d.generateId(), d.now()),
    deps,
  )
}
