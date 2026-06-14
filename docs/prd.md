# WhatLog PRD

**Version:** 0.3  
**Status:** Draft  
**Author:** June  
**Date:** 2026-06-14

---

## Executive Summary

WhatLog (`wl`) is a personal CLI action log for capturing what you're doing throughout the day. A single command appends a timestamped, optionally tagged entry to a single append-only JSONL file. Entries are queryable by date range and filterable by tag. The tool is built in plain TypeScript with a functional-core/imperative-shell architecture, runs on Bun, and follows XDG directory conventions. It is a personal productivity tool — not a team or multi-user product — and is designed to stay out of the way while being genuinely useful at review time.

---

## North Star Statement

> *WhatLog exists so that June can reconstruct what she actually worked on and when, without having to remember.*

---

## Problem Statement

Knowledge work produces no physical artifact trail. At the end of a day, week, or sprint, recalling what was done — for standups, retros, personal reflection, or just peace of mind — requires memory, which is unreliable. Existing solutions are either too heavy (full task managers, time trackers with timers), too manual (bullet journals, sticky notes), or buried inside larger tools that require context-switching to use.

The ideal tool has zero friction on write and reasonable power on read. The closest analog is `git log` — you don't think about it while you work, but it's invaluable when you need it.

**Current coping mechanisms and their shortcomings:**
- Mental recall — fails under cognitive load, especially across context switches
- Slack messages to self — buried, unsearchable in aggregate, tied to a third-party platform
- Notes apps — require opening a separate app, breaking flow
- Task managers — oriented toward future work, not past captures; too structured

**Cost of the problem unsolved:** Fragmented self-knowledge. Difficulty writing standups. No personal accountability trail. The sense that time passed without visible output.

---

## Goals

1. Appending an entry requires one command and no ceremony — `wl "doing the thing"` and done.
2. Inline `#hashtag` syntax extracts tags without requiring flags.
3. Entries are queryable by date, date range, and tag, covering the common review scenarios.
4. The data format is human-readable, portable, and not tied to this tool — plain JSONL.
5. The append-only storage model preserves a full audit trail; edits and deletes are recorded as amendments, never overwrites.
6. The tool is built in plain TypeScript with a functional-core/imperative-shell architecture (pure logic isolated from side effects; a hand-rolled `Result<T, E>` type for fallible operations), making it a focused learning project for core TypeScript — discriminated unions, generics, narrowing, and async — without a heavy framework. Reaching for a library like Effect is deferred until the project is large enough to feel the problem it solves.

---

## Non-Goals

- **Not a task manager.** WhatLog is a log, not a todo list. It records what happened, not what's planned.
- **Not a time tracker.** There are no timers, durations, or "start/stop" semantics.
- **Not multi-user or synced.** No cloud sync, no shared logs, no conflict resolution.
- **Not published to npm.** This is a personal tool installed locally via Bun.
- **Not a general-purpose note-taking app.** Entries are short, flat, and intentionally constrained.
- **Not interactive.** No TUI, no prompts. Pure command-line, composable with other Unix tools.

---

## User Personas

### The Solo Engineer in Flow

**Who they are:** A developer who context-switches frequently across tickets, meetings, investigations, and side efforts. Often loses track of what they actually did by EOD.

**Key traits:** High cognitive load, values low-friction tools, lives in the terminal, does not want to leave the keyboard.

**Core needs:** A frictionless way to mark moments — "I just did a thing" — without disrupting flow.

**Pain points with existing alternatives:** Task managers demand too much structure. Note apps require mouse or app-switching. Slack-to-self disappears into the void.

*(Note: This is a single-user tool. This is the only persona. It's June.)*

---

## Rough User Stories

- As a solo engineer, I want to log an entry with a single command so that I don't break my flow.
- As a solo engineer, I want to add tags inline with `#hashtag` syntax so that I don't have to remember a separate flag.
- As a solo engineer, I want to view today's log so that I can write a standup from it.
- As a solo engineer, I want to view this week's or this month's log so that I can write a retro or reflection.
- As a solo engineer, I want to filter entries by tag so that I can see all `#ci` work, for example.
- As a solo engineer, I want to view entries across a custom date range so that I can review any arbitrary period.
- As a solo engineer, I want to delete or edit a logged entry by its ID so that I can correct mistakes.
- As a solo engineer, I want each entry to have a short, minimally-typeable ID (like `jj`'s prefix system) so that I can reference entries without copy-pasting long strings.
- As a solo engineer, I want the underlying data to be plain JSONL so that I can inspect, grep, or back it up without tooling.

---

## Feature Scope

### Core Logging

**`wl "<message>"`** — Append a new entry to the log.

- Appends to `$XDG_DATA_HOME/whatlog/whatlog.jsonl` (default: `~/.local/share/whatlog/whatlog.jsonl`)
- Record schema:
  ```json
  {
    "id": "a3f8c2d1",
    "timestamp": "2026-06-13T18:42:00.000Z",
    "message": "working on the thingy #ci #enablement",
    "tags": ["ci", "enablement"],
    "type": "entry"
  }
  ```
- `#hashtag` tokens in the message are parsed at write time and stored in `tags` without the `#` prefix (e.g. `"ci"`, not `"#ci"`); they remain in the message string as written
- IDs are short random hex strings (8 chars), globally unique
- Serves: solo engineer

---

### Querying

**`wl ls`** — Full log view, `git log` style. Most recent entries first.

- Default: last 20 entries
- Display: short unique ID prefix (highlighted), human-relative timestamp, message with tags colored
- Date boundaries rendered as a muted separator between days:
  ```
  ── June 13, 2026 ──────────────────
  a3f   2 hours ago   working on the thingy #ci #enablement
  b1c   3 hours ago   standup done
  ── June 12, 2026 ──────────────────
  f4a   yesterday     fixed the cursed build
  ```
- Serves: solo engineer

**`wl today`** — Shorthand for `wl ls --date today`

**`wl yesterday`** — Shorthand for `wl ls --date yesterday`

**`wl week`** — All entries in the current calendar week (Mon–Sun)

**`wl month`** — All entries in the current calendar month

**`wl ls --date <YYYY-MM-DD>`** — Entries for a specific ISO date

**`wl ls --start <YYYY-MM-DD> --end <YYYY-MM-DD>`** — Entries across an arbitrary date range

**`wl ls --tag <tag>`** — Filter any of the above by tag (combinable with date flags)

---

### Amendment (Edit & Delete)

**`wl rm <id-prefix>`** — Mark an entry as deleted.

- Before writing, displays the matched entry and prompts `y/N` for confirmation
- On confirmation, appends a tombstone record to `whatlog.jsonl`:
  ```json
  {
    "id": "b1c2d3e4",
    "timestamp": "2026-06-13T20:00:00.000Z",
    "type": "delete",
    "targetId": "a3f8c2d1"
  }
  ```
- Deleted entries are excluded from all query views
- No bytes are ever overwritten

**`wl edit <id-prefix> "<new message>"`** — Amend an entry.

- Before writing, displays the matched entry and prompts `y/N` for confirmation
- On confirmation, appends an amendment record to `whatlog.jsonl`:
  ```json
  {
    "id": "c3d4e5f6",
    "timestamp": "2026-06-13T20:05:00.000Z",
    "type": "edit",
    "targetId": "a3f8c2d1",
    "message": "corrected message #ci",
    "tags": ["ci"]
  }
  ```
- At read time, the resolver applies amendments and tombstones before displaying
- Serves: solo engineer

---

### ID Resolution

- Each entry gets an 8-character random hex ID at write time
- At query time, the shortest unique prefix across all visible (non-tombstoned) entries in the current result set is computed and displayed
- For `rm` and `edit`, WhatLog scans the full log to find a match for the given prefix
- Ambiguous prefixes produce a clear error listing all matches; the user must supply more characters

---

### Configuration

- Data dir: `$XDG_DATA_HOME/whatlog/` (default: `~/.local/share/whatlog/`); created on first run if absent
- Config dir: `$XDG_CONFIG_HOME/whatlog/` (default: `~/.config/whatlog/`)
- Override data dir via `WHATLOG_DATA_DIR` env var; override config dir via `WHATLOG_CONFIG_DIR` (each directory has its own explicit override, rather than a single ambiguous flag)
- Config file: `~/.config/whatlog/config.toml` (optional; tool works with sensible defaults without it)
- Configurable: default entry count for `wl ls`, date/time display format preference

---

## Out of Scope

- No npm publishing or global registry distribution
- No multi-machine sync or conflict resolution
- No start/stop time tracking or duration calculation
- No TUI or interactive mode
- No import from or export to other tools (Notion, Linear, etc.)
- No recurring entries, reminders, or scheduled logs
- No full-text search beyond `--tag` filtering (grep/ripgrep the JSONL directly if needed)
- No Windows or Linux support as primary targets (macOS + Bun is the target)

---

## Considered but Deferred

**Per-day log files** — Splitting the log into `YYYY-MM-DD.jsonl` files feels organizationally tidy but creates a lookup problem for ID resolution (which file is entry `a3f` in?) that requires either a full scan of all files or a maintained index. At personal scale (~15k entries over 3 years ≈ 2.5MB), a single file scanned linearly is fast and far simpler. Revisit if the file ever becomes unwieldy.

**Full-text search (`wl ls --search "thingy"`)** — Obvious extension, but grep + ripgrep against the JSONL file covers it for now. Defer until the query interface has settled.

**`wl ls -n <count>` flag** — Control how many entries `wl ls` returns. Easy to add later once the default behavior is validated through use.

**Piping / machine-readable output (`wl ls --json`)** — Useful for scripting. Deferred in favor of getting the human display right first.

**Multiple named logs** — `wl --log work "doing the thing"` to support separate logs for different contexts. Interesting but adds complexity to ID resolution and config. Not needed for a personal tool yet.

**Shell completion** — Tab completion for subcommands and ID prefixes. Worth doing eventually; Bun has some support for this. Deferred post-v1.

**`wl since <natural language>`** — `wl since monday`, `wl since "last week"`. Fun and usable, but requires a date parsing library and is non-trivial to get right. Deferred.

**Config command (`wl config set ...`)** — Editing `config.toml` by hand is fine for now.

---

## Assumptions

- Bun is installed on the target machine and available on `$PATH`
- At personal scale, streaming and filtering a single JSONL file is fast enough for all query operations — no indexing needed
- Only one instance of `wl` runs at a time; no concurrent write safety is needed
- The user is comfortable editing `config.toml` by hand if they want to customize defaults
- No third-party runtime framework (Effect, RxJS, etc.); the standard library plus Bun's APIs are sufficient at this scale. Runtime validation of records is hand-rolled or via a lightweight schema lib if needed.
- `~/.local/share` does not exist by default on macOS but is safe to create; the tool creates it on first run
- Install story: `bun build --compile` produces a standalone binary, symlinked into `~/.local/bin/wl`