import crypto from 'node:crypto'

const TODO_MARKER_RE = /<!--todo:([a-f0-9-]{8,})-->/

export type ParsedTodo = {
  id: string
  title: string
  status: 'open' | 'done'
  topicName: string | null
}

export type ParsedTopicEntry = {
  topicName: string
  contentMarkdown: string
}

export function indexDailyMarkdown(markdown: string): {
  markdown: string
  todos: ParsedTodo[]
  topicEntries: ParsedTopicEntry[]
} {
  const lines = markdown.split('\n')
  const todos: ParsedTodo[] = []
  const topicEntries: ParsedTopicEntry[] = []

  let currentTopic: string | null = null
  let currentTopicBody: string[] = []

  function flushTopic() {
    if (!currentTopic) return
    const content = currentTopicBody.join('\n').trim()
    if (content) topicEntries.push({ topicName: currentTopic, contentMarkdown: content })
    currentTopic = null
    currentTopicBody = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const hr = line.match(/^\s*---\s*$/)
    if (hr) {
      flushTopic()
      continue
    }

    const h3 = line.match(/^\s*###\s+(.+?)\s*$/)
    if (h3) {
      flushTopic()
      currentTopic = h3[1].trim()
      currentTopicBody = []
      continue
    }

    const h1h2 = line.match(/^\s*#{1,2}\s+/)
    if (h1h2) {
      flushTopic()
      continue
    }

    const todoMatch = line.match(/^\s*-\s*\[( |x|X)\]\s+(.+?)\s*$/)
    if (todoMatch) {
      const checked = todoMatch[1].toLowerCase() === 'x'
      const rawText = todoMatch[2]
      if (rawText.trim()) {
        const markerMatch = line.match(TODO_MARKER_RE)
        const id = markerMatch?.[1] ?? crypto.randomUUID()
        const title = rawText.replace(TODO_MARKER_RE, '').trim()

        if (!markerMatch) {
          lines[i] = `${line} <!--todo:${id}-->`
        }

        todos.push({
          id,
          title,
          status: checked ? 'done' : 'open',
          topicName: currentTopic,
        })
      }
    }

    if (currentTopic) {
      currentTopicBody.push(lines[i])
    }
  }

  flushTopic()

  return {
    markdown: lines.join('\n'),
    todos,
    topicEntries,
  }
}

