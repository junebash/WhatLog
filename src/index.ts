import { Future, Result } from "@bloodyowl/boxed"
import { Temporal } from "temporal-polyfill"

import { WhatLog, loadConfig } from "./config.ts"
import { appendEntry } from "./append.ts"
import { listEntries } from "./list.ts"
import {
  dayRange,
  monthRange,
  parseIsoDate,
  rangeBetween,
  todayRange,
  weekRange,
  yesterdayRange,
} from "./query.ts"
import type { DateRange, EntryFilter } from "./query.ts"
import { alwaysYes, confirmImpl, defaultAmendDeps, editEntry, removeEntry } from "./amend.ts"
import type { AmendOutcome, Confirm } from "./amend.ts"

const USAGE = `whatlog — a personal, append-only action log

usage:
  wl "<message>"                        append an entry (#tags parsed inline)
  wl ls [--date D] [--start D --end D] [--tag T]
  wl today | yesterday | week | month   [--tag T]
  wl rm <id-prefix> [--yes]
  wl edit <id-prefix> "<message>" [--yes]
  wl help                               show this message

flags:
  --date D            ISO date (YYYY-MM-DD)
  --start D --end D   inclusive date range
  --tag T             filter by tag
  --yes, -y           skip confirmation prompts
  --help, -h          show this message`

// --- tiny argv parser: positionals + value-flags + boolean --yes/-y ---

type Args = {
  positionals: string[]
  flags: Map<string, string>
  yes: boolean
}

const VALUE_FLAGS = new Set(["date", "start", "end", "tag"])

function parseArgs(tokens: string[]): Result<Args, Error> {
  const positionals: string[] = []
  const flags = new Map<string, string>()
  let yes = false

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] ?? ""
    if (token === "--yes" || token === "-y") {
      yes = true
    } else if (token.startsWith("--")) {
      const name = token.slice(2)
      if (!VALUE_FLAGS.has(name)) {
        return Result.Error(new Error(`unknown flag: ${token}`))
      }
      const value = tokens[i + 1]
      if (value === undefined) {
        return Result.Error(new Error(`flag --${name} needs a value`))
      }
      flags.set(name, value)
      i += 1
    } else {
      positionals.push(token)
    }
  }

  return Result.Ok({ positionals, flags, yes })
}

// --- build the date range for `wl ls` from its flags ---

function lsRange(flags: Map<string, string>, zone: string): Result<DateRange | undefined, Error> {
  const date = flags.get("date")
  const start = flags.get("start")
  const end = flags.get("end")

  if (date !== undefined) {
    return parseIsoDate(date).map((d) => dayRange(d, zone))
  }
  if (start !== undefined && end !== undefined) {
    return parseIsoDate(start).flatMap((s) =>
      parseIsoDate(end).map((e) => rangeBetween(s, e, zone)),
    )
  }
  if (start !== undefined || end !== undefined) {
    return Result.Error(new Error("--start and --end must be used together"))
  }
  return Result.Ok(undefined)
}

type Context = {
  environment: Record<string, string | undefined>
  now: Temporal.ZonedDateTime
  zone: string
  color: boolean
}

/** `wl ls` and the date shorthands, parameterized by the range to show. */
function runList(
  range: DateRange | undefined,
  tag: string | undefined,
  count: number | undefined,
  ctx: Context,
): Future<Result<string, Error>> {
  const filter: EntryFilter = {}
  if (range !== undefined) {
    filter.range = range
  }
  if (tag !== undefined) {
    filter.tag = tag
  }
  return listEntries({ filter, count, color: ctx.color, now: ctx.now })
}

function describeOutcome(outcome: AmendOutcome): string {
  if (outcome.tag === "aborted") {
    return "aborted"
  }
  if (outcome.record.type === "delete") {
    return `deleted ${outcome.entry.id}`
  }
  if (outcome.record.type === "edit") {
    return `edited ${outcome.entry.id} — ${outcome.record.message}`
  }
  return `logged ${outcome.entry.id}`
}

/**
 * Route the parsed args to a command. Each branch returns the line to print on
 * success. An unrecognized first token isn't an error — it means the whole arg
 * string is a new entry's message (the zero-ceremony `wl "..."` path).
 */
function dispatch(args: Args, raw: string, ctx: Context): Future<Result<string, Error>> {
  const [command, ...rest] = args.positionals
  const tag = args.flags.get("tag")
  const confirm: Confirm = args.yes ? alwaysYes : confirmImpl

  switch (command) {
    case "ls":
      return lsRange(args.flags, ctx.zone).match({
        Error: (error): Future<Result<string, Error>> => Future.value(Result.Error(error)),
        // A date filter shows the whole range; a bare `ls` caps to the config default.
        Ok: (range) =>
          loadConfig(ctx.environment).flatMapOk((config) =>
            runList(range, tag, range === undefined ? config.defaultCount : undefined, ctx),
          ),
      })
    case "today":
      return runList(todayRange(ctx.now), tag, undefined, ctx)
    case "yesterday":
      return runList(yesterdayRange(ctx.now), tag, undefined, ctx)
    case "week":
      return runList(weekRange(ctx.now), tag, undefined, ctx)
    case "month":
      return runList(monthRange(ctx.now), tag, undefined, ctx)
    case "rm": {
      const prefix = rest[0]
      if (prefix === undefined) {
        return Future.value(Result.Error(new Error("usage: wl rm <id-prefix>")))
      }
      return removeEntry(prefix, { ...defaultAmendDeps, confirm }).mapOk(describeOutcome)
    }
    case "edit": {
      const prefix = rest[0]
      const message = rest.slice(1).join(" ").trim()
      if (prefix === undefined || message.length === 0) {
        return Future.value(Result.Error(new Error('usage: wl edit <id-prefix> "<message>"')))
      }
      return editEntry(prefix, message, { ...defaultAmendDeps, confirm }).mapOk(describeOutcome)
    }
    default:
      return appendEntry(raw).mapOk((record) => `logged ${record.id} — ${record.message}`)
  }
}

function main(argv: string[]): void {
  const tokens = argv.slice(2)
  const raw = tokens.join(" ").trim()

  // Explicit help is success: print to stdout and exit 0.
  if (tokens.some((t) => t === "--help" || t === "-h") || tokens[0] === "help") {
    console.log(USAGE)
    return
  }

  // No args at all is a misuse: usage goes to stderr with a failure code.
  if (raw.length === 0) {
    console.error(USAGE)
    process.exitCode = 1
    return
  }

  const parsed = parseArgs(tokens)
  if (parsed.isError()) {
    console.error(`error: ${parsed.getError().message}`)
    process.exitCode = 1
    return
  }
  const args = parsed.get()

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const ctx: Context = {
    environment: process.env,
    zone,
    now: Temporal.Now.zonedDateTimeISO(zone),
    color: process.stdout.isTTY === true,
  }

  WhatLog.setUp()
    .flatMapOk(() => dispatch(args, raw, ctx))
    .tap((result) =>
      result.match({
        Ok: (output) => console.log(output),
        Error: (error) => {
          console.error(`error: ${error.message}`)
          process.exitCode = 1
        },
      }),
    )
}

main(process.argv)
