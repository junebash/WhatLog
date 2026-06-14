import { Result } from "@bloodyowl/boxed"

import { toError } from "./errors.ts"

/**
 * A log is an append-only stream of these records. `entry` is a new line;
 * `edit` / `delete` are amendments that point at an earlier entry by `targetId`.
 * The shared `type` field is the *discriminant* — TypeScript narrows the union
 * by switching on it.
 */
export type EntryRecord = {
  type: "entry"
  id: string
  timestamp: string
  message: string
  tags: string[]
}

export type EditRecord = {
  type: "edit"
  id: string
  timestamp: string
  targetId: string
  message: string
  tags: string[]
}

export type DeleteRecord = {
  type: "delete"
  id: string
  timestamp: string
  targetId: string
}

export type LogRecord = EntryRecord | EditRecord | DeleteRecord

export function toJsonLine(record: LogRecord): string {
  return JSON.stringify(record)
}

// --- validation: turning untrusted `unknown` into a trusted `LogRecord` ---

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

/**
 * Validate a parsed-but-untyped value into a `LogRecord`. Returns an `Error`
 * (never throws) describing the first field that fails — this is the seam where
 * data from disk stops being `unknown` and becomes a type we can trust.
 */
export function parseRecord(value: unknown): Result<LogRecord, Error> {
  if (!isObject(value)) {
    return Result.Error(new Error("record must be an object"))
  }

  const id = value["id"]
  const timestamp = value["timestamp"]
  if (typeof id !== "string") {
    return Result.Error(new Error("record.id must be a string"))
  }
  if (typeof timestamp !== "string") {
    return Result.Error(new Error("record.timestamp must be a string"))
  }

  const type = value["type"]
  switch (type) {
    case "entry": {
      const message = value["message"]
      const tags = value["tags"]
      if (typeof message !== "string") {
        return Result.Error(new Error("entry.message must be a string"))
      }
      if (!isStringArray(tags)) {
        return Result.Error(new Error("entry.tags must be an array of strings"))
      }
      return Result.Ok({ type, id, timestamp, message, tags })
    }
    case "edit": {
      const message = value["message"]
      const tags = value["tags"]
      const targetId = value["targetId"]
      if (typeof message !== "string") {
        return Result.Error(new Error("edit.message must be a string"))
      }
      if (!isStringArray(tags)) {
        return Result.Error(new Error("edit.tags must be an array of strings"))
      }
      if (typeof targetId !== "string") {
        return Result.Error(new Error("edit.targetId must be a string"))
      }
      return Result.Ok({ type, id, timestamp, targetId, message, tags })
    }
    case "delete": {
      const targetId = value["targetId"]
      if (typeof targetId !== "string") {
        return Result.Error(new Error("delete.targetId must be a string"))
      }
      return Result.Ok({ type, id, timestamp, targetId })
    }
    default:
      return Result.Error(new Error(`unknown record type: ${String(type)}`))
  }
}

/** Parse one JSONL line (JSON decode can throw, so we wrap it) into a record. */
export function parseLine(line: string): Result<LogRecord, Error> {
  return Result.fromExecution(() => JSON.parse(line) as unknown)
    .mapError(toError)
    .flatMap(parseRecord)
}
