---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Note: `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc` is a symlink to this file, so the
> frontmatter above must stay for the Cursor rule to load. Edit content below it.

## What this is

WhatLog (`wl`) is a personal, append-only CLI action log — `wl "doing the thing #tag"` to capture,
`wl ls` / `wl today` / `wl week` to query. Full design is in [docs/prd.md](docs/prd.md).

This is a **learning project**: the real goal is exercising core TypeScript (discriminated unions,
narrowing, generics, async) and a clean architecture, *not* shipping features fast. Two consequences
that should shape how you work here:

- **No heavy frameworks.** Fallible operations use a hand-rolled functional substrate — `Result<T, E>`
  and `Future<T>` from `@bloodyowl/boxed` — instead of `throw`/`try`. Reaching for Effect is
  deliberately deferred until the project is big enough to feel the problem it solves. Don't introduce
  it (or similar) unprompted.
- **Explain the "why."** When making non-trivial changes, favor explaining the reasoning and TS
  mechanics, not just the diff. The existing code is heavily commented in this spirit — match that.

## Commands

Tasks are wrapped in a `Justfile` (run `just` to list); the same steps exist as `package.json` scripts.

```bash
just run <args>        # run from source, e.g. `just run today --tag ci`  (= bun src/index.ts <args>)
just test              # bun test
just typecheck         # tsc --noEmit  (tsconfig is noEmit + bundler mode)
just build             # compile standalone binary -> dist/wl
just install           # build, then copy wl onto $PATH (WHATLOG_BIN_DIR, default ~/.local/bin)

bun test src/query.test.ts                 # run one test file
bun test --test-name-pattern "weekRange"   # run tests matching a name
```

## Architecture

**Functional core / imperative shell.** Every command is split into pure logic and the I/O around it:

- *Cores* are pure functions — same input, same output, no clock/filesystem/randomness. Examples:
  `buildEntry`/`buildEdit`/`buildDelete` (`append.ts`, `amend.ts`), `resolveEntries` (`resolve.ts`),
  `filterEntries`/`sortNewestFirst` and the Temporal range builders (`query.ts`), `parseTags`
  (`tags.ts`), `parseRecord`/`parseLine` (`records.ts`), `matchPrefix` (`prefix.ts`), `renderLog`
  (`render.ts`), `parseConfig` (`config.ts`). Test these directly with plain values.
- *Shells* pull effects from injected capabilities, call the cores, and write back. Each command
  (`appendEntry`, `editEntry`/`removeEntry`, `listEntries`) takes a `deps` bag with default
  implementations, so tests swap in stubs. The injectable seams are typed: `AppendLine`/`ReadText`
  (`storage.ts`), `GenerateId` (`ids.ts`), `Confirm` (`amend.ts`), `MakeDirectory` (`config.ts`),
  plus `now: () => Date` and `environment`. The `deps`-bag pattern is the hand-rolled stand-in for an
  Effect "context."

**The append-only log is the heart of the data model.** Storage is a single JSONL file
(`whatlog.jsonl`) that is an append-only stream of `LogRecord`s — a discriminated union over `type`:
`entry` (a new line), `edit` (replaces message/tags of a `targetId`), `delete` (a tombstone for a
`targetId`). See `records.ts`. **Edits and deletes never overwrite bytes** — they append amendments.
`resolveEntries` (`resolve.ts`) is the fold that replays this stream into the set of currently-visible
`ResolvedEntry`s; the entire read path runs through it. Amendments pointing at unknown ids are ignored,
not errors. When changing storage, preserve append-only semantics and keep `parseRecord` strict
(it's the trust boundary turning `unknown` from disk into a typed record).

**Data flow of a read** (`list.ts`): read file → `resolveEntries` (fold amendments) →
`filterEntries` (range + tag) → `sortNewestFirst` → cap to `count` → `shortestUniquePrefixes`
(jj-style shortest-unique short ids, computed over the *displayed* set) → `renderLog`.

**Errors flow through `Result`/`Future`, never exceptions.** `toError` (`errors.ts`) is the funnel
that coerces caught/rejected `unknown` into a real `Error` at every boundary. A missing file is *not*
an error: a missing log reads as empty, a missing `config.toml` yields defaults.

**Dates use Temporal** (`temporal-polyfill` until Bun ships it natively). Day/week/month boundaries are
resolved in an explicit zone (carried by a `ZonedDateTime`), reduced to absolute `Instant`s, then
compared — no ambient time zone. Ranges are half-open `[start, end)`. The zone is resolved once at
startup in `index.ts` and threaded down; don't reach for the ambient zone deeper in the call tree.

`index.ts` is the only entry point: parse argv → build a `Context` → `WhatLog.setUp()` (ensure XDG
dirs) → `dispatch` to a command → print the `Ok` line or an `error:` line and set `process.exitCode`.

## Conventions

- **Never `throw`/`try` for control flow, and never force-unwrap** (no `!`, no `try!` equivalent).
  Model fallibility with `Result`; chain with `.map`/`.flatMap`/`.mapOk`/`.flatMapOk`/`.match`.
- Imports use explicit `.ts` extensions (`allowImportingTsExtensions`), and `import type` for
  type-only imports (`verbatimModuleSyntax` is on).
- tsconfig is strict, plus `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature` — index
  access yields `T | undefined` and must be guarded; read env/JSON via `value["key"]`, not `value.key`.
- Tests are colocated `*.test.ts` using `bun:test`; unwrap `Result`s with `unwrap`/`unwrapErr` from
  `test-utils.ts` rather than asserting-then-`.get()`.
- Blank line between imports and the rest; no trailing whitespace on blank lines.

## Version control

This repo uses **Jujutsu (`jj`)**, not git directly (note the `.jj/` directory, no `.git/`). Use `jj`
commands for history and commits. Use `trash`, never `rm -rf`.

## Bun runtime conventions

Default to Bun over Node tooling: `bun <file>` / `bunx <pkg>` / `bun install` / `bun run <script>`.
Bun auto-loads `.env` (no `dotenv`). Prefer `Bun.file` over `node:fs` read/write where practical —
current I/O uses `node:fs/promises` behind the `storage.ts` seams; keep that injectable shape. If
new needs arise, prefer Bun built-ins (`bun:sqlite`, `Bun.redis`, `Bun.sql`, `WebSocket`, `Bun.$`)
over `better-sqlite3`/`ioredis`/`pg`/`ws`/`execa`. This is currently a dependency-light CLI with no
server or frontend.
