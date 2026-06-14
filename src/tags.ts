const TAG_PATTERN = /#(\w+)/g

/**
 * Extract `#hashtags` from a message, stripped of the `#` and de-duplicated
 * (first occurrence wins). Pure: no side effects, no dependencies — so it needs
 * no injection. The message itself is returned unchanged elsewhere; this only
 * pulls the tag list out.
 */
export function parseTags(message: string): string[] {
  const tags: string[] = []
  for (const match of message.matchAll(TAG_PATTERN)) {
    // match[1] is the capture group. Under `noUncheckedIndexedAccess` it's typed
    // `string | undefined`, so we guard before using it.
    const tag = match[1]
    if (tag !== undefined && !tags.includes(tag)) {
      tags.push(tag)
    }
  }
  return tags
}
