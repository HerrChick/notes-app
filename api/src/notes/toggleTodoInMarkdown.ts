const MARKER = (id: string) => `<!--todo:${id}-->`

export function toggleTodoCheckboxInMarkdown(markdown: string, todoId: string, checked: boolean): string {
  const marker = MARKER(todoId)
  const lines = markdown.split('\n')
  let changed = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.includes(marker)) continue

    // Replace the first checkbox marker in this line.
    const next = line.replace(/^(\s*-\s*\[)( |x|X)(\])/, `$1${checked ? 'x' : ' '}$3`)
    if (next !== line) {
      lines[i] = next
      changed = true
    }
    break
  }

  return changed ? lines.join('\n') : markdown
}

