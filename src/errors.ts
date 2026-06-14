/**
 * Coerce an `unknown` (from a `catch` or a rejected promise) into a real `Error`.
 *
 * JS lets you `throw` anything, so caught/rejected values are typed `unknown`.
 * Anywhere we promise an `Error` in a `Result`'s error channel, we funnel
 * through here to make that promise true.
 */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}
