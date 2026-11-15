import { supabase } from '@/lib/supabase'

interface PendingMessage { id: string; event_chat_id: string; sender_id: string; content: string }
interface Delivery {
  draft: string
  pending: PendingMessage | null
  sending: boolean
  error: string | null
  sentVersion: number
}

// Lives outside the route so an in-flight insert survives navigation/unmount.
// Only drafts/payloads are stored; never credentials. User IDs isolate accounts.
const deliveries = new Map<string, Delivery>()
const listeners = new Set<() => void>()
const storageKey = (target: string) => `poruch.chat-draft.v1:${target}`

export function getChatDelivery(target: string): Delivery {
  let state = deliveries.get(target)
  if (!state) {
    state = { draft: '', pending: null, sending: false, error: null, sentVersion: 0 }
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey(target)) ?? 'null')
      if (saved && typeof saved.draft === 'string') state.draft = saved.draft
      const p = saved?.pending
      if (p && typeof p.id === 'string' && typeof p.event_chat_id === 'string' && typeof p.content === 'string'
        && typeof p.sender_id === 'string' && target.startsWith(`${p.sender_id}:`)) {
        state.pending = p
        state.error = 'Перевірте з’єднання та повторіть надсилання'
      }
    } catch { /* Storage may be unavailable in private browsing. */ }
    deliveries.set(target, state)
  }
  return state
}

function update(target: string, patch: Partial<Delivery>) {
  const next = { ...getChatDelivery(target), ...patch }
  deliveries.set(target, next)
  try {
    if (!next.draft && !next.pending) sessionStorage.removeItem(storageKey(target))
    else sessionStorage.setItem(storageKey(target), JSON.stringify({ draft: next.draft, pending: next.pending }))
  } catch { /* Navigation still preserves the in-memory operation. */ }
  listeners.forEach(listener => listener())
}

export function subscribeChatDelivery(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setChatDraft(target: string, draft: string) { update(target, { draft }) }

async function deliver(target: string) {
  const state = getChatDelivery(target)
  if (!state.pending || state.sending) return
  const message = state.pending
  // Lock synchronously: repeated Enter/clicks cannot start a second insert.
  update(target, { sending: true, error: null })
  try {
    const { error } = await supabase.from('event_chat_messages').insert(message)
    if (error) {
      // A lost response may mean the first insert succeeded. Retry the same PK;
      // confirm a duplicate belongs to this exact message instead of inserting twice.
      if (error.code !== '23505') throw error
      const existing = await supabase.from('event_chat_messages').select('id, content')
        .eq('id', message.id).eq('event_chat_id', message.event_chat_id).eq('sender_id', message.sender_id).maybeSingle()
      if (existing.error || existing.data?.content !== message.content) throw existing.error ?? error
    }
    update(target, { pending: null, sending: false, error: null, sentVersion: getChatDelivery(target).sentVersion + 1 })
  } catch {
    // Keep the exact payload/UUID for an explicit retry, including after remount.
    update(target, { sending: false, error: 'Не вдалося підтвердити надсилання. Повторіть спробу' })
  }
}

export function sendChatDraft(target: string, chatId: string, userId: string) {
  const state = getChatDelivery(target)
  const content = state.draft.trim()
  if (state.pending || !content || content.length > 2000 || !target.startsWith(`${userId}:`)) return
  update(target, { draft: '', pending: { id: crypto.randomUUID(), event_chat_id: chatId, sender_id: userId, content } })
  return deliver(target)
}

export function retryChatDelivery(target: string) { return deliver(target) }
