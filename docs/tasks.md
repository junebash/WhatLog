# WhatLog Tasks

Decomposed from [prd.md](./prd.md) (v0.2). Check off as completed.

IDs are stable — never reuse a number, even if a task is dropped.

---

## Foundation

- [ ] **WL-1** — Scaffold Bun + TypeScript + Effect v3 project (`package.json`, `tsconfig`, Effect deps, source layout)
- [ ] **WL-2** — Path resolution: XDG data/config dirs, `WHATLOG_DIR` override, create data dir on first run · _deps: WL-1_
- [ ] **WL-3** — Config loading: optional `config.toml` (default entry count, date/time format) with sensible defaults when absent · _deps: WL-2_

## Domain & Storage

- [ ] **WL-4** — Record schema via Effect Schema: `entry` / `edit` / `delete` variants (id, timestamp, message, tags, targetId, type) · _deps: WL-1_
- [ ] **WL-5** — JSONL storage layer: append-only writer + streaming reader over `whatlog.jsonl` · _deps: WL-2, WL-4_
- [ ] **WL-6** — ID generation: 8-char random hex, globally unique · _deps: WL-1_
- [ ] **WL-7** — Hashtag parser: extract `#tags` at write time, strip `#`, leave message string intact · _deps: WL-1_

## Write Path

- [ ] **WL-8** — `wl "<message>"` append command (wires WL-4/5/6/7) · _deps: WL-5, WL-6, WL-7_

## Read Path

- [ ] **WL-9** — Amendment resolver: fold `edit`/`delete` records over base entries at read time · _deps: WL-5_
- [ ] **WL-10** — Shortest-unique-prefix computation across visible (non-tombstoned) entries · _deps: WL-9_
- [ ] **WL-11** — `wl ls` renderer: reverse-chron, day separators, relative timestamps, colored tags, ID-prefix highlight · _deps: WL-9, WL-10_
- [ ] **WL-12** — Date filtering core: `--date`, `--start`/`--end`, `--tag` (combinable) · _deps: WL-9_
- [ ] **WL-13** — Shorthand commands: `today`, `yesterday`, `week` (Mon–Sun), `month` · _deps: WL-12_

## Amendment Commands

- [ ] **WL-14** — Prefix matching for `rm`/`edit`: full-log scan, ambiguity error listing all matches · _deps: WL-9_
- [ ] **WL-15** — `wl rm <id-prefix>`: show matched entry, `y/N` confirm, append tombstone record · _deps: WL-14_
- [ ] **WL-16** — `wl edit <id-prefix> "<msg>"`: show matched entry, `y/N` confirm, append amendment record · _deps: WL-14, WL-7_

## Ship

- [ ] **WL-17** — `bun build --compile` standalone binary + symlink into `~/.local/bin/wl` · _deps: WL-8 (minimum viable write path)_
- [ ] **WL-18** — Test suite: parser, ID resolution, amendment resolver, date math, storage round-trip · _deps: ongoing_

---

## Dependency sketch

```
WL-1 ─┬─ WL-2 ── WL-3
      ├─ WL-4 ──┐
      ├─ WL-6 ──┤
      └─ WL-7 ──┤
                ├─ WL-5 ── WL-8 ── WL-17
                │           │
                └─ WL-9 ─┬─ WL-10 ── WL-11
                         ├─ WL-12 ── WL-13
                         └─ WL-14 ─┬─ WL-15
                                   └─ WL-16
WL-18 spans the whole build.
```

## Suggested first slice (walking skeleton)

WL-1 → WL-2 → WL-4 → WL-5 → WL-6 → WL-7 → WL-8 gets you a working `wl "..."`
append. Then WL-9 → WL-11 makes `wl ls` show it back. Everything else layers on.
