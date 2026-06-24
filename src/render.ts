import { Temporal } from "temporal-polyfill"

import type { ResolvedEntry } from "./resolve.ts"

/**
 * Rendering options. `now` is a `ZonedDateTime`, so the zone used to group
 * entries into days is explicit — no ambient time zone leaks in. `color` is
 * injected (the shell sets it from `process.stdout.isTTY`) so the renderer stays
 * a pure string-builder: piped output gets no escape codes, and tests can assert
 * on plain text. `hour12` selects 12- vs 24-hour clock; the shell resolves the
 * `"auto"` config to a concrete boolean so the renderer reads no ambient locale.
 */
export type RenderOptions = {
  color: boolean
  now: Temporal.ZonedDateTime
  hour12: boolean
}

// --- ANSI styling, all gated on the `color` flag (no dependency) ---

const RESET = "\x1b[0m"

function style(code: string, text: string, color: boolean): string {
  return color ? `\x1b[${code}m${text}${RESET}` : text
}

const dim = (text: string, color: boolean) => style("2", text, color)
const yellow = (text: string, color: boolean) => style("33", text, color)
const cyan = (text: string, color: boolean) => style("36", text, color)

/**
 * Clock time as `hh:mm`. Each entry already sits under a day separator carrying
 * the date, so the per-entry column just needs the time of day. 24-hour pads the
 * hour ("09:05", "14:30"); 12-hour drops the leading zero and appends a period
 * ("9:05 AM", "2:30 PM"), with midnight/noon mapping to 12. Pure: the zone is
 * baked into the passed `PlainTime` and the cycle into `hour12`.
 */
export function formatTime(time: Temporal.PlainTime, hour12: boolean): string {
  const minute = time.minute.toString().padStart(2, "0")
  if (!hour12) {
    return `${time.hour.toString().padStart(2, "0")}:${minute}`
  }
  const period = time.hour < 12 ? "AM" : "PM"
  const hour = time.hour % 12 === 0 ? 12 : time.hour % 12
  return `${hour}:${minute} ${period}`
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
 * highlighted short id, the entry's clock time, and the message with its `#tags`
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
  const times = zoned.map((zdt) => formatTime(zdt.toPlainTime(), options.hour12))
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
