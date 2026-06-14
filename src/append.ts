import type { Future, Result } from "@bloodyowl/boxed"

import { WhatLogConfig } from "./config.ts"
import { parseTags } from "./tags.ts"
import { toJsonLine } from "./records.ts"
import type { EntryRecord } from "./records.ts"
import { generateIdImpl } from "./ids.ts"
import type { GenerateId } from "./ids.ts"
import { appendLineImpl } from "./storage.ts"
import type { AppendLine } from "./storage.ts"

/**
 * Everything the append command needs from the outside world, gathered into one
 * object. This is the hand-rolled equivalent of an Effect "context": once a
 * command needs more than ~two dependencies, a `deps` bag beats a long
 * parameter list.
 */
export type AppendEntryDeps = {
  environment: Record<string, string | undefined>
  generateId: GenerateId
  now: () => Date
  appendLine: AppendLine
}

export const defaultAppendEntryDeps: AppendEntryDeps = {
  environment: process.env,
  generateId: generateIdImpl,
  now: () => new Date(),
  appendLine: appendLineImpl,
}

/**
 * Functional core: build the record from inputs. Pure — given the same message,
 * id, and timestamp it always produces the same record. No filesystem, no clock,
 * no randomness reach in here; the caller supplies the id and time.
 */
export function buildEntry(message: string, id: string, timestamp: Date): EntryRecord {
  return {
    type: "entry",
    id,
    timestamp: timestamp.toISOString(),
    message,
    tags: parseTags(message),
  }
}

/**
 * Imperative shell: pull id + time from the injected capabilities, build the
 * record, append it. Resolves with the record so the caller can report it.
 */
export function appendEntry(
  message: string,
  deps: AppendEntryDeps = defaultAppendEntryDeps,
): Future<Result<EntryRecord, Error>> {
  const record = buildEntry(message, deps.generateId(), deps.now())
  const path = WhatLogConfig.logFile(deps.environment)
  return deps.appendLine(path, toJsonLine(record)).mapOk(() => record)
}
