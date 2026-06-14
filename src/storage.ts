import { appendFile, readFile } from "node:fs/promises"
import { Future, Result } from "@bloodyowl/boxed"

import { toError } from "./errors.ts"
import { parseLine } from "./records.ts"
import type { LogRecord } from "./records.ts"

/** Injectable filesystem capabilities — the seam that keeps storage testable. */
export type AppendLine = (path: string, line: string) => Future<Result<void, Error>>
export type ReadText = (path: string) => Future<Result<string, Error>>

export const appendLineImpl: AppendLine = (path, line) =>
  Future.fromPromise(appendFile(path, `${line}\n`, "utf8"))
    .mapOk(() => undefined)
    .mapError(toError)

export const readTextImpl: ReadText = (path) =>
  Future.fromPromise(readFile(path, "utf8")).mapError(toError)

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  )
}

/** Parse every non-blank line; fail fast on the first malformed record. */
function parseRecords(text: string): Result<LogRecord[], Error> {
  const records: LogRecord[] = []
  for (const line of text.split("\n")) {
    if (line.trim().length === 0) {
      continue
    }
    const parsed = parseLine(line)
    if (parsed.isError()) {
      return Result.Error(parsed.getError())
    }
    records.push(parsed.get())
  }
  return Result.Ok(records)
}

/**
 * Read all records from the log. A missing file means "no entries yet", not an
 * error — so first-run reads succeed with an empty list.
 */
export function readRecords(
  path: string,
  readText: ReadText = readTextImpl,
): Future<Result<LogRecord[], Error>> {
  return readText(path).map((result) =>
    result.match({
      Ok: (text) => parseRecords(text),
      Error: (error) =>
        isFileNotFound(error) ? Result.Ok<LogRecord[], Error>([]) : Result.Error(error),
    }),
  )
}
