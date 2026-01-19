export type AppEventName = 'todosChanged' | 'topicsChanged' | 'dailyChanged'

type AppEventDetailMap = {
  todosChanged: { todoId?: string; dailyDate?: string } | undefined
  topicsChanged: { topicName?: string } | undefined
  dailyChanged: { date?: string } | undefined
}

export type LocalOnlyEventName = 'editorInsertText' | 'editorActiveChanged'

type LocalOnlyEventDetailMap = {
  editorInsertText: { text: string }
  editorActiveChanged: { active: boolean }
}

type WireMessage<E extends AppEventName = AppEventName> = {
  name: E
  detail: AppEventDetailMap[E]
  originId: string
  nonce: string
  ts: number
}

const CHANNEL_NAME = 'note-taking-app'
const STORAGE_KEY_PREFIX = `${CHANNEL_NAME}:event`

function randomId() {
  // crypto.randomUUID is widely supported in modern browsers; fall back safely.
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const ORIGIN_ID = randomId()
const target = new EventTarget()
const localOnlyTarget = new EventTarget()

function dispatchLocal<E extends AppEventName>(name: E, detail: AppEventDetailMap[E]) {
  target.dispatchEvent(new CustomEvent(name, { detail }))
}

function dispatchLocalOnly<E extends LocalOnlyEventName>(name: E, detail: LocalOnlyEventDetailMap[E]) {
  localOnlyTarget.dispatchEvent(new CustomEvent(name, { detail }))
}

const bc: BroadcastChannel | null = (() => {
  try {
    if (typeof BroadcastChannel === 'undefined') return null
    return new BroadcastChannel(CHANNEL_NAME)
  } catch {
    return null
  }
})()

function onWireMessage(msg: WireMessage) {
  if (!msg || typeof msg !== 'object') return
  if (msg.originId === ORIGIN_ID) return
  dispatchLocal(msg.name, msg.detail as never)
}

if (bc) {
  bc.addEventListener('message', (ev) => {
    onWireMessage(ev.data as WireMessage)
  })
} else if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev) => {
    if (!ev.key) return
    if (!ev.key.startsWith(STORAGE_KEY_PREFIX)) return
    if (!ev.newValue) return
    try {
      const msg = JSON.parse(ev.newValue) as WireMessage
      onWireMessage(msg)
    } catch {
      // ignore
    }
  })
}

export function emitAppEvent<E extends AppEventName>(name: E, detail?: AppEventDetailMap[E]) {
  const msg: WireMessage<E> = { name, detail, originId: ORIGIN_ID, nonce: randomId(), ts: Date.now() }

  // Same-tab listeners should update immediately.
  dispatchLocal(name, detail as AppEventDetailMap[E])

  // Cross-tab broadcast.
  try {
    if (bc) {
      bc.postMessage(msg)
    } else if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${STORAGE_KEY_PREFIX}:${name}`, JSON.stringify(msg))
    }
  } catch {
    // ignore
  }
}

export function onAppEvent<E extends AppEventName>(
  name: E,
  handler: (detail: AppEventDetailMap[E]) => void,
) {
  const listener = (ev: Event) => {
    handler((ev as CustomEvent).detail as AppEventDetailMap[E])
  }
  target.addEventListener(name, listener)
  return () => target.removeEventListener(name, listener)
}

export function emitLocalOnlyEvent<E extends LocalOnlyEventName>(name: E, detail: LocalOnlyEventDetailMap[E]) {
  dispatchLocalOnly(name, detail)
}

export function onLocalOnlyEvent<E extends LocalOnlyEventName>(
  name: E,
  handler: (detail: LocalOnlyEventDetailMap[E]) => void,
) {
  const listener = (ev: Event) => {
    handler((ev as CustomEvent).detail as LocalOnlyEventDetailMap[E])
  }
  localOnlyTarget.addEventListener(name, listener)
  return () => localOnlyTarget.removeEventListener(name, listener)
}

export const emitEditorInsertText = (text: string) => emitLocalOnlyEvent('editorInsertText', { text })

export const setEditorActive = (active: boolean) => emitLocalOnlyEvent('editorActiveChanged', { active })

export function createThrottledEmitter<E extends AppEventName>(name: E, waitMs: number) {
  let lastEmittedAt = 0
  let timeout: ReturnType<typeof setTimeout> | null = null
  let pendingDetail: AppEventDetailMap[E] | undefined

  return (detail?: AppEventDetailMap[E]) => {
    pendingDetail = detail
    const now = Date.now()
    const remaining = waitMs - (now - lastEmittedAt)

    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      lastEmittedAt = now
      emitAppEvent(name, pendingDetail as AppEventDetailMap[E])
      pendingDetail = undefined
      return
    }

    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null
        lastEmittedAt = Date.now()
        emitAppEvent(name, pendingDetail as AppEventDetailMap[E])
        pendingDetail = undefined
      }, remaining)
    }
  }
}

export const emitTodosChanged = (detail?: AppEventDetailMap['todosChanged']) =>
  emitAppEvent('todosChanged', detail)

export const emitTopicsChanged = (detail?: AppEventDetailMap['topicsChanged']) =>
  emitAppEvent('topicsChanged', detail)

export const emitDailyChanged = (detail?: AppEventDetailMap['dailyChanged']) =>
  emitAppEvent('dailyChanged', detail)

// Defaults tuned for “multi-tab live update” without thrashing.
export const emitTodosChangedThrottled = createThrottledEmitter('todosChanged', 1500)
export const emitTopicsChangedThrottled = createThrottledEmitter('topicsChanged', 2000)
export const emitDailyChangedThrottled = createThrottledEmitter('dailyChanged', 1500)

