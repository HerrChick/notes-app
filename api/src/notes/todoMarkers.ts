import crypto from 'node:crypto'

const MARKER_RE = /<!--todo:([a-f0-9-]{8,})-->/i
const MARKER_RE_GLOBAL = /<!--todo:[a-f0-9-]{8,}-->/gi
const MARKER_CAPTURE_RE_GLOBAL = /<!--todo:([a-f0-9-]{8,})-->/gi
const TODO_LINE_RE = /^(\s*-\s*\[)( |x|X)(\])(\s+)(.+?)\s*$/

function normalizeTitleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

function extractMarkerId(line: string): string | null {
  const m = line.match(MARKER_RE)
  return m?.[1] ? m[1].toLowerCase() : null
}

function extractAllMarkerIds(line: string): string[] {
  const ids: string[] = []
  MARKER_CAPTURE_RE_GLOBAL.lastIndex = 0
  for (let m = MARKER_CAPTURE_RE_GLOBAL.exec(line); m; m = MARKER_CAPTURE_RE_GLOBAL.exec(line)) {
    if (m[1]) ids.push(m[1].toLowerCase())
  }
  return ids
}

function stripMarkers(text: string): string {
  return text.replace(MARKER_RE_GLOBAL, '').trim()
}

export type ExtractedTodo = {
  id: string
  title: string
  status: 'open' | 'done'
  line: number
}

export function ensureTodoMarkers(markdown: string): { markdown: string; todos: ExtractedTodo[] } {
  const lines = markdown.split('\n')
  const todos: ExtractedTodo[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(TODO_LINE_RE)
    if (!match) continue

    const checked = match[2].toLowerCase() === 'x'
    const rawText = match[5]
    if (!rawText.trim()) continue

    const markerId = extractMarkerId(line)
    const id = markerId ?? crypto.randomUUID()
    const title = stripMarkers(rawText)

    // Canonicalize to a single lowercase marker at end of line.
    lines[i] = `${match[1]}${match[2]}${match[3]}${match[4]}${title} <!--todo:${id}-->`

    todos.push({
      id,
      title,
      status: checked ? 'done' : 'open',
      line: i,
    })
  }

  return { markdown: lines.join('\n'), todos }
}

export function stabilizeTodoMarkers(opts: {
  previousMarkdown: string
  nextMarkdown: string
}): { markdown: string } {
  const prev = ensureTodoMarkers(opts.previousMarkdown ?? '')

  const prevIds = new Set<string>()
  const byTitle = new Map<string, string[]>()
  const prevTitleKeyById = new Map<string, string>()

  for (const t of prev.todos) {
    const id = t.id.toLowerCase()
    prevIds.add(id)
    const key = normalizeTitleKey(t.title)
    const arr = byTitle.get(key)
    if (arr) arr.push(id)
    else byTitle.set(key, [id])
    prevTitleKeyById.set(id, key)
  }

  const nextLines = (opts.nextMarkdown ?? '').split('\n')

  // Reserve known ids that already exist for this date so that:
  // - Existing todos keep their ids even if order changes
  // - Pasted/edited lines without markers can't "steal" an existing id
  // - Duplicate marker ids are handled deterministically (first keeps, rest get new)
  const reservedIds = new Set<string>()
  const reservedIdByLine = new Map<number, string>()

  for (let i = 0; i < nextLines.length; i++) {
    const line = nextLines[i]
    const match = line.match(TODO_LINE_RE)
    if (!match) continue
    const rawText = match[5]
    if (!rawText.trim()) continue

    const title = stripMarkers(rawText)
    if (!title) continue
    const titleKey = normalizeTitleKey(title)

    const markerId = extractMarkerId(line)
    if (!markerId) continue
    if (!prevIds.has(markerId)) continue
    if (reservedIds.has(markerId)) continue

    // If the marker id belongs to a *different* existing todo title for this day,
    // treat it as an edited id and do not reserve it. This prevents swapping ids
    // between existing todos while still allowing title edits on an existing id.
    const prevKeyForMarker = prevTitleKeyById.get(markerId)
    const hasPriorForTitle = (byTitle.get(titleKey)?.length ?? 0) > 0
    if (prevKeyForMarker && prevKeyForMarker !== titleKey && hasPriorForTitle) {
      continue
    }

    reservedIds.add(markerId)
    reservedIdByLine.set(i, markerId)
  }

  const usedIds = new Set<string>()

  for (let i = 0; i < nextLines.length; i++) {
    const line = nextLines[i]
    const match = line.match(TODO_LINE_RE)
    if (!match) continue

    const rawText = match[5]
    if (!rawText.trim()) continue

    const title = stripMarkers(rawText)
    if (!title) continue

    const key = normalizeTitleKey(title)
    const queue = byTitle.get(key) ?? []

    let id: string | null = null

    // Existing todos keep their ids (even if title changed).
    const reserved = reservedIdByLine.get(i)
    if (reserved) {
      id = reserved
    } else {
      // Marker is missing/unknown/duplicate -> prefer reusing a prior id for the
      // same title that isn't already reserved/used. Otherwise generate a new id.
      while (queue.length && (usedIds.has(queue[0]!) || reservedIds.has(queue[0]!))) queue.shift()
      id = queue.shift() ?? null
    }

    if (!id) id = crypto.randomUUID()
    usedIds.add(id)

    // Minimize rewrites: if the line already has exactly one correct marker at end,
    // keep the original line text unchanged (reduces diff churn while editing).
    const idLower = id.toLowerCase()
    const markerIds = extractAllMarkerIds(line)
    const hasOnlyCorrectMarker = markerIds.length === 1 && markerIds[0] === idLower
    const hasCorrectMarkerAtEnd = new RegExp(`\\s*<!--todo:${idLower}-->\\s*$`, 'i').test(line)

    if (hasOnlyCorrectMarker && hasCorrectMarkerAtEnd) {
      continue
    }

    // Otherwise, rebuild with a single canonical marker at end.
    const withoutMarkers = line.replace(MARKER_RE_GLOBAL, '').trimEnd()
    nextLines[i] = `${withoutMarkers} <!--todo:${id}-->`
  }

  return { markdown: nextLines.join('\n') }
}

