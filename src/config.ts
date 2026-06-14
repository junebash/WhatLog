import { join } from "node:path"
import { mkdir } from "node:fs/promises"
import { Future, Result } from "@bloodyowl/boxed"
import type { MakeDirectoryOptions } from "node:fs"

import { toError } from "./errors.ts"
import { readTextImpl } from "./storage.ts"
import type { ReadText } from "./storage.ts"

export namespace WhatLogConfig {
  const configDirKey = "WHATLOG_CONFIG_DIR"
  const dataDirKey = "WHATLOG_DATA_DIR"
  const xdgConfigHomeKey = "XDG_CONFIG_HOME"
  const xdgDataHomeKey = "XDG_DATA_HOME"
  const homeKey = "HOME"

  export function configDirectory(environment: Record<string, string | undefined>): string {
    const configDir = environment[configDirKey]
    if (configDir) {
      return configDir
    }
    const xdgConfigHome = environment[xdgConfigHomeKey]
    if (xdgConfigHome) {
      return join(xdgConfigHome, "whatlog")
    }
    return join(environment[homeKey] ?? "/", ".config", "whatlog")
  }

  export function dataDirectory(environment: Record<string, string | undefined>): string {
    const dataDir = environment[dataDirKey]
    if (dataDir) {
      return dataDir
    }
    const xdgDataHome = environment[xdgDataHomeKey]
    if (xdgDataHome) {
      return join(xdgDataHome, "whatlog")
    }
    return join(environment[homeKey] ?? "/", ".local", "share", "whatlog")
  }

  export function configFile(environment: Record<string, string | undefined>): string {
    return join(configDirectory(environment), "config.toml")
  }

  export function logFile(environment: Record<string, string | undefined>): string {
    return join(dataDirectory(environment), "whatlog.jsonl")
  }
}

export type MakeDirectory = (path: string, options?: MakeDirectoryOptions) => Future<Result<void, Error>>

export const makeDirectoryImpl: MakeDirectory = (path, options) =>
  Future.fromPromise(mkdir(path, options))
    .mapOk(() => undefined)
    .mapError(toError)

export function ensureDirectory(
  path: string,
  makeDirectory: MakeDirectory = makeDirectoryImpl,
): Future<Result<void, Error>> {
  return makeDirectory(path, { recursive: true })
}

export namespace WhatLog {
  export function setUp(
    context: {
      environment: Record<string, string | undefined>
      makeDirectory: MakeDirectory
    } = {
      environment: process.env,
      makeDirectory: makeDirectoryImpl,
    },
  ): Future<Result<void, Error>> {
    const { environment, makeDirectory } = context
    return ensureDirectory(WhatLogConfig.dataDirectory(environment), makeDirectory)
      .flatMapOk(() => ensureDirectory(WhatLogConfig.configDirectory(environment), makeDirectory))
  }
}

// --- WL-3: optional config.toml (sensible defaults when absent) ---

/**
 * Tunable defaults. Kept tiny on purpose — the tool is fully usable with no
 * config file at all. `dateFormat` is reserved for the renderer's future use.
 */
export type Config = {
  defaultCount: number
  dateFormat?: string
}

export const defaultConfig: Config = {
  defaultCount: 20,
}

/**
 * Parse the supported subset of TOML: `key = value` lines, where value is an
 * integer or a double-quoted string, plus `#` comments and blank lines. Pure —
 * a hand-rolled parser for two keys, so we don't pull in a TOML dependency.
 * Recognized keys: `default_count` (int) and `date_format` (string); unknown
 * keys are ignored so future additions don't break old binaries.
 */
export function parseConfig(text: string): Result<Config, Error> {
  const config: Config = { ...defaultConfig }

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim()
    if (line.length === 0 || line.startsWith("#")) {
      continue
    }

    const equals = line.indexOf("=")
    if (equals === -1) {
      return Result.Error(new Error(`invalid config line: ${rawLine}`))
    }
    const key = line.slice(0, equals).trim()
    const value = line.slice(equals + 1).trim()

    switch (key) {
      case "default_count": {
        const count = Number(value)
        if (!Number.isInteger(count) || count <= 0) {
          return Result.Error(new Error(`default_count must be a positive integer, got: ${value}`))
        }
        config.defaultCount = count
        break
      }
      case "date_format": {
        if (!value.startsWith('"') || !value.endsWith('"') || value.length < 2) {
          return Result.Error(new Error(`date_format must be a quoted string, got: ${value}`))
        }
        config.dateFormat = value.slice(1, -1)
        break
      }
      default:
        // Unknown key — ignore for forward compatibility.
        break
    }
  }

  return Result.Ok(config)
}

function isFileNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  )
}

/**
 * Load config from `config.toml`. A missing file is not an error — it yields the
 * defaults — mirroring how the storage layer treats a missing log as empty.
 */
export function loadConfig(
  environment: Record<string, string | undefined>,
  readText: ReadText = readTextImpl,
): Future<Result<Config, Error>> {
  return readText(WhatLogConfig.configFile(environment)).map((result) =>
    result.match({
      Ok: (text) => parseConfig(text),
      Error: (error) =>
        isFileNotFound(error) ? Result.Ok<Config, Error>(defaultConfig) : Result.Error(error),
    }),
  )
}
