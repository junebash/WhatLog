import type { Result } from "@bloodyowl/boxed"

/**
 * Unwrap an `Ok`, throwing if it's an `Error`. boxed types `.get()` to require a
 * statically-known `Ok`, so tests narrow through here instead of asserting then
 * unwrapping. The throw surfaces the underlying error message on a wrong guess.
 */
export function unwrap<A, E>(result: Result<A, E>): A {
  if (result.isError()) {
    throw new Error(`expected Ok, got Error: ${String(result.getError())}`)
  }
  return result.get()
}

/** Unwrap an `Error`, throwing if it's actually `Ok`. */
export function unwrapErr<A, E>(result: Result<A, E>): E {
  if (result.isOk()) {
    throw new Error("expected Error, got Ok")
  }
  return result.getError()
}
