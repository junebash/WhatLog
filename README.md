# whatlog

A personal, append-only CLI action log — capture what you're doing, query it later.
See [docs/prd.md](docs/prd.md) for the full design.

## Install

Install dependencies:

```bash
bun install
```

Then build and install the `wl` binary onto your `PATH`:

```bash
just install
```

This compiles a standalone binary and copies it to `~/.local/bin/wl` (override
with `WHATLOG_BIN_DIR`). Make sure that directory is on your `PATH`. To remove
it later, run `just uninstall`.

Prefer not to install? You can run straight from source instead — see
[Usage](#usage) and [Development](#development).

## Usage

Once installed, invoke `wl` directly. To run from source without building, use
`just run <args>` (or `bun src/index.ts <args>`).

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

Common tasks are wrapped in a [`Justfile`](Justfile) — run `just` to list them:

```bash
just build       # compile a standalone binary into dist/wl
just install     # build, then copy wl onto your PATH
just uninstall   # remove the installed binary
just run <args>  # run from source without building, e.g. `just run today --tag ci`
just test        # run the test suite
just typecheck   # tsc --noEmit
just clean       # delete build artifacts (dist/)
```

The same build/test/typecheck steps are also exposed as `package.json` scripts
(`bun run build`, `bun run test`, `bun run typecheck`) if you'd rather not use
`just`.
