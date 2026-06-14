# whatlog

A personal, append-only CLI action log — capture what you're doing, query it later.
See [docs/prd.md](docs/prd.md) for the full design.

## Install

```bash
bun install
```

## Usage

Run with `bun src/index.ts <args>` (or build a `wl` binary — see WL-17).

```bash
# Append an entry. Inline #hashtags are parsed into tags automatically.
wl "working on the thingy #ci #enablement"

# View the log (newest first; defaults to the last 20 entries).
wl ls

# Date shorthands (show everything in range).
wl today
wl yesterday
wl week           # current calendar week, Mon–Sun
wl month          # current calendar month

# Filters (combinable).
wl ls --tag ci
wl ls --date 2026-06-14
wl ls --start 2026-06-01 --end 2026-06-14
wl ls --date 2026-06-14 --tag ci

# Amend the log (append-only: edits/deletes never overwrite bytes).
wl edit <id-prefix> "corrected message #ci"
wl rm <id-prefix>
#   Both prompt y/N first; pass --yes (or -y) to skip the prompt.
```

IDs are shown as the shortest unique prefix across the displayed entries, so you
usually only type a character or two for `edit`/`rm`.

## Configuration

- Data: `$WHATLOG_DATA_DIR`, else `$XDG_DATA_HOME/whatlog`, else `~/.local/share/whatlog`
- Config: `$WHATLOG_CONFIG_DIR`, else `$XDG_CONFIG_HOME/whatlog`, else `~/.config/whatlog`
- Optional `config.toml` (everything has a sensible default):

  ```toml
  default_count = 20      # entries shown by a bare `wl ls`
  date_format = "relative"
  ```

Day/week/month boundaries are computed in your machine's local time zone,
resolved explicitly at startup (via [Temporal](https://tc39.es/proposal-temporal/),
currently the `temporal-polyfill` package until Bun ships it natively).

## Development

```bash
bun test            # run the test suite
bunx tsc --noEmit   # typecheck
```
