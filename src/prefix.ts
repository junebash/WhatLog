import type { ResolvedEntry } from "./resolve.ts"

/**
 * The result of looking up an id prefix for `rm` / `edit`. A discriminated union
 * so the caller is forced to handle every outcome — no match, exactly one, or an
 * ambiguous set the user must disambiguate by typing more characters.
 */
export type PrefixMatch =
  | { tag: "none" }
  | { tag: "one"; entry: ResolvedEntry }
  | { tag: "many"; matches: ResolvedEntry[] }

/**
 * Functional core for `wl rm` / `wl edit` id resolution: find every visible
 * entry whose id starts with `prefix`. An empty prefix matches nothing (refuse
 * to act on "all entries"). Pure — operates on the already-resolved entry set.
 */
export function matchPrefix(prefix: string, entries: ResolvedEntry[]): PrefixMatch {
  if (prefix.length === 0) {
    return { tag: "none" }
  }

  const matches = entries.filter((entry) => entry.id.startsWith(prefix))

  if (matches.length === 0) {
    return { tag: "none" }
  }
  const [only] = matches
  if (matches.length === 1 && only !== undefined) {
    return { tag: "one", entry: only }
  }
  return { tag: "many", matches }
}
