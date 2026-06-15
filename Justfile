# whatlog tasks. Run `just` to see this list.

# Where `just install` puts the compiled binary.
bin_dir := env_var_or_default("WHATLOG_BIN_DIR", env_var("HOME") / ".local/bin")

# Show available recipes.
default:
    @just --list

# Compile a standalone `wl` binary into dist/.
build:
    bun build src/index.ts --compile --outfile dist/wl

# Build, then install `wl` onto your PATH ({{bin_dir}}).
install: build
    mkdir -p {{bin_dir}}
    cp dist/wl {{bin_dir}}/wl
    @echo "Installed wl -> {{bin_dir}}/wl"

# Remove the installed binary.
uninstall:
    trash {{bin_dir}}/wl 2>/dev/null || rm -f {{bin_dir}}/wl

# Run the CLI from source without building, e.g. `just run today --tag ci`.
run *args:
    bun src/index.ts {{args}}

# Run the test suite.
test:
    bun test

# Typecheck without emitting.
typecheck:
    bunx tsc --noEmit

# Delete build artifacts.
clean:
    trash dist 2>/dev/null || rm -rf dist
