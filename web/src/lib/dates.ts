export function todayISO(now = new Date()): string {
  // Local date in YYYY-MM-DD (not UTC).
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function lastNDaysISO(days: number, now = new Date()): string[] {
  const out: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    out.push(todayISO(d))
  }
  return out
}
