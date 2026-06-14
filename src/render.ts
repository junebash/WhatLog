import { Temporal } from "temporal-polyfill"

import type { ResolvedEntry } from "./resolve.ts"

/**
 * Rendering options. `now` is a `ZonedDateTime`, so the zone used to group
 * entries into days is explicit — no ambient time zone leaks in. `color` is
 * injected (the shell sets it from `process.stdout.isTTY`) so the renderer stays
 * a pure string-builder: piped output gets no escape codes, and tests can assert
 * on plain text.
 */
export type RenderOptions = {
  color: boolean
  now: Temporal.ZonedDateTime
}

// --- ANSI styling, all gated on the `color` flag (no dependency) ---

const RESET = "\x1b[0m"

function style(code: string, text: string, color: boolean): string {
  return color ? `\x1b[${code}m${text}${RESET}` : text
}

const dim = (text: string, color: boolean) => style("2", text, color)
const yellow = (text: string, color: boolean) => style("33", text, color)
const cyan = (text: string, color: boolean) => style("36", text, color)

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE

/**
 * Human-relative timestamp, `git log`–style. Elapsed buckets ("just now",
 * minutes, hours) are zone-independent real time; the day buckets ("yesterday",
 * "N days ago", absolute date) are computed in `now`'s zone via calendar-day
 * difference. Both `then` and `now` are zoned, so the day math is explicit.
 */
export function relativeTime(then: Temporal.ZonedDateTime, now: Temporal.ZonedDateTime): string {
  const diff = now.toInstant().epochMilliseconds - then.toInstant().epochMilliseconds

  if (diff < MS_PER_MINUTE) {
    return "just now"
  }
  if (diff < MS_PER_HOUR) {
    const minutes = Math.floor(diff / MS_PER_MINUTE)
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`
  }

  const days = now.toPlainDate().since(then.toPlainDate(), { largestUnit: "day" }).days
  if (days === 0) {
    const hours = Math.floor(diff / MS_PER_HOUR)
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
  }
  if (days === 1) {
    return "yesterday"
  }
  if (days < 7) {
    return `${days} days ago`
  }
  return then.toPlainDate().toLocaleString("en-US", { month: "short", day: "numeric" })
}

function dayHeading(date: Temporal.PlainDate): string {
  return date.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function separator(date: Temporal.PlainDate, color: boolean): string {
  const heading = dayHeading(date)
  const line = `── ${heading} ${"─".repeat(Math.max(3, 40 - heading.length))}`
  return dim(line, color)
}

const TAG_PATTERN = /#(\w+)/g

function colorizeTags(message: string, color: boolean): string {
  if (!color) {
    return message
  }
  return message.replace(TAG_PATTERN, (match) => cyan(match, color))
}

function padEnd(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length)
}

/**
 * Render resolved entries as the `wl ls` view: reverse-chronological, with a
 * muted day separator whenever the calendar day changes (in `now`'s zone), a
 * highlighted short id, a relative timestamp, and the message with its `#tags`
 * colored. `entries` must already be sorted newest-first; `prefixes` maps full
 * id → short unique id.
 */
export function renderLog(
  entries: ResolvedEntry[],
  prefixes: Map<string, string>,
  options: RenderOptions,
): string {
  if (entries.length === 0) {
    return "(no entries)"
  }

  const zone = options.now.timeZoneId
  const zoned = entries.map((entry) => Temporal.Instant.from(entry.timestamp).toZonedDateTimeISO(zone))

  const shortIds = entries.map((entry) => prefixes.get(entry.id) ?? entry.id)
  const idWidth = Math.max(...shortIds.map((id) => id.length))
  const times = zoned.map((zdt) => relativeTime(zdt, options.now))
  const timeWidth = Math.max(...times.map((time) => time.length))

  const lines: string[] = []
  let currentDay: string | undefined

  entries.forEach((entry, index) => {
    const zdt = zoned[index]
    if (zdt === undefined) {
      return
    }
    const date = zdt.toPlainDate()
    const heading = dayHeading(date)
    if (heading !== currentDay) {
      if (currentDay !== undefined) {
        lines.push("")
      }
      lines.push(separator(date, options.color))
      currentDay = heading
    }

    const shortId = shortIds[index] ?? entry.id
    const time = times[index] ?? ""
    const idCell = yellow(padEnd(shortId, idWidth), options.color)
    const timeCell = dim(padEnd(time, timeWidth), options.color)
    lines.push(`${idCell}  ${timeCell}  ${colorizeTags(entry.message, options.color)}`)
  })

  return lines.join("\n")
}
