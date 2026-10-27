import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useAdmin } from '@/contexts/AdminContext'
import { supabase } from '@/lib/supabase'
import BrandLogo from '@/components/BrandLogo'
import { Icon } from '@/components/icons'

type Section = 'users' | 'events' | 'audit'
type Member = { id: string; name: string; city: string | null; age: number | null; gender: string | null; avatar_url: string | null; email: string | null; email_confirmed: boolean; is_anonymous: boolean; created_at: string; last_sign_in_at: string | null; event_count: number; joined_count: number }
type AdminEvent = { id: string; title: string; description: string; address_text: string; event_type: string; is_public: boolean; join_mode: string; status: string; event_datetime: string; organizer_name: string; max_participants: number; participant_count: number; can_restore: boolean }
type Audit = { id: number; event_title: string; action: string; reason: string; previous_status: string; next_status: string; created_at: string }
type Result = { rows: (Member | AdminEvent | Audit)[]; total: number; page: number; page_size: number; cities: string[]; stats: { profiles: number; new_week: number; anonymous: number; events: number; upcoming_events: number; cancelled_events: number } }
const tabs: { id: Section; title: string }[] = [{ id: 'users', title: 'Учасники' }, { id: 'events', title: 'Події' }, { id: 'audit', title: 'Журнал дій' }]
const statusLabels: Record<string, string> = { upcoming: 'Заплановано', active: 'Триває', completed: 'Завершено', cancelled: 'Скасовано' }
const field = 'min-h-11 rounded-xl border border-brand-border bg-white px-3 text-sm outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/15'
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-brand-border bg-white px-4 text-sm font-bold transition hover:bg-brand-accent-soft disabled:opacity-50 disabled:cursor-not-allowed'
function date(value: string | null) { return value ? new Date(value).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv', dateStyle: 'medium', timeStyle: 'short' }) : '—' }
function actionError(message: string) {
  if (message.includes('event_changed')) return 'Подія вже змінилася. Оновіть список і повторіть дію.'
  if (message.includes('cannot_restore_event')) return 'Відновити можна лише майбутню подію, скасовану в адмінці.'
  if (message.includes('admin_required')) return 'Доступ адміністратора не підтверджено. Увійдіть повторно.'
  return 'Не вдалося виконати дію. Спробуйте ще раз.'
}

export default function Admin() {
  const { supaUser } = useAuth()
  const { isAdmin, loading, error, retry } = useAdmin()
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  async function login() {
    setLoggingIn(true); setLoginError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: {
        redirectTo: new URL(`${import.meta.env?.BASE_URL ?? '/'}admin`, window.location.origin).toString(),
        queryParams: { prompt: 'select_account', login_hint: 'dr12071980@gmail.com' },
      } })
      if (error) throw error
    } catch { setLoginError('Не вдалося відкрити вхід Google. Спробуйте ще раз.'); setLoggingIn(false) }
  }
  return <div className="min-h-screen bg-brand-bg text-brand-ink">
    <header className="border-b border-brand-border bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6"><Link to="/" aria-label="Poruch — головна"><BrandLogo className="w-28" /></Link><Link to="/" className="text-sm font-bold text-brand-accent">До платформи →</Link></div></header>
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-9">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-accent">Керування спільнотою</p><h1 className="text-3xl font-extrabold tracking-tight">Адміністрування ПОРУЧ</h1></div>{isAdmin && <span className="rounded-full border border-brand-accent/20 bg-brand-accent-soft px-3 py-2 text-xs font-bold text-brand-accent">{supaUser?.email}</span>}</div>
      {loading ? <p role="status">Перевіряємо доступ…</p> : isAdmin ? <AdminDashboard key={supaUser?.id} /> : <section className="mx-auto max-w-lg rounded-2xl border border-brand-border bg-white p-6 sm:p-8">
        <Icon name="userCheck" className="mb-4 h-9 w-9 text-brand-accent" />
        <h2 className="text-xl font-extrabold">{error ? 'Не вдалося перевірити доступ' : 'Вхід адміністратора'}</h2>
        <p className="mt-3 text-sm leading-6 text-brand-ink-soft">Цей розділ доступний лише підтвердженому Google-акаунту <strong>dr12071980@gmail.com</strong>.</p>
        {supaUser && <p className="mt-3 text-sm text-brand-ink-muted">Зараз: {supaUser.email || 'профіль без email'}. Вхід переключить акаунт; створені події залишаться за попереднім профілем.</p>}
        {error && <button className={`${button} mt-4`} onClick={retry}>Повторити перевірку</button>}
        <button onClick={() => void login()} disabled={loggingIn} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-accent px-4 text-sm font-bold text-white disabled:opacity-50">{loggingIn ? 'Відкриваємо Google…' : 'Увійти через Google'}</button>
        {loginError && <p role="alert" className="mt-3 text-sm text-red-700">{loginError}</p>}
      </section>}
    </main>
  </div>
}

export function AdminDashboard() {
  const [section, setSection] = useState<Section>('users')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [data, setData] = useState<Result | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [action, setAction] = useState<{ event: AdminEvent; kind: 'cancel' | 'restore' } | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const reasonInput = useRef<HTMLTextAreaElement>(null)
  const actionTrigger = useRef<HTMLElement | null>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let cancelled = false
    setBusy(true); setError(''); setData(null)
    void (async () => {
      try {
        const result = await supabase.rpc('poruch_admin_data', { p_section: section, p_search: query, p_city: section === 'users' ? city : '', p_page: page })
        if (cancelled) return
        if (result.error) throw result.error
        if (!result.data) throw new Error('empty_admin_response')
        setData(result.data as Result)
      } catch { if (!cancelled) setError('Не вдалося завантажити дані. Перевірте з’єднання та доступ.') }
      finally { if (!cancelled) setBusy(false) }
    })()
    return () => { cancelled = true }
  }, [section, query, city, page, refresh])
  useEffect(() => { if (action) reasonInput.current?.focus() }, [action])
  function changeSection(next: Section) { setSection(next); setPage(1); setQuery(''); setSearch(''); setCity(''); setNotice('') }
  function submitSearch(event: FormEvent) { event.preventDefault(); setQuery(search.trim()); setPage(1) }
  function openAction(event: AdminEvent, kind: 'cancel' | 'restore') { actionTrigger.current = document.activeElement as HTMLElement; setAction({ event, kind }); setReason(''); setSaveError('') }
  function closeAction() { if (saving) return; setAction(null); actionTrigger.current?.focus() }
  async function saveAction(event: FormEvent) {
    event.preventDefault()
    if (!action || saving || reason.trim().length < 3) return
    setSaving(true); setSaveError('')
    try {
      const result = await supabase.rpc('poruch_admin_set_event_status', { p_event_id: action.event.id, p_action: action.kind, p_reason: reason.trim(), p_expected_status: action.event.status })
      if (result.error) throw result.error
      if (!mounted.current) return
      setNotice(action.kind === 'cancel' ? 'Подію скасовано. Дію записано до журналу.' : 'Подію відновлено. Дію записано до журналу.')
      setAction(null); setRefresh(value => value + 1)
    } catch (err) { if (mounted.current) setSaveError(actionError((err as { message?: string }).message ?? '')) }
    finally { if (mounted.current) setSaving(false) }
  }
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 25))
  return <>
    {data && <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">{[
      ['Профілів', data.stats.profiles], ['Нових за 7 днів', data.stats.new_week], ['Без email', data.stats.anonymous], ['Усього подій', data.stats.events], ['Майбутніх подій', data.stats.upcoming_events], ['Скасованих', data.stats.cancelled_events],
    ].map(([label, value]) => <div key={label} className="rounded-2xl border border-brand-border bg-white p-4"><p className="text-xs text-brand-ink-muted">{label}</p><p className="mt-2 text-3xl font-extrabold tabular-nums">{value}</p></div>)}</div>}
    <div className="rounded-2xl border border-brand-border bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="group" aria-label="Розділи адміністрування">{tabs.map(tab => <button key={tab.id} aria-pressed={section === tab.id} onClick={() => changeSection(tab.id)} className={`${button} ${section === tab.id ? '!border-brand-accent !bg-brand-accent !text-white' : ''}`}>{tab.title}</button>)}</div><button className={button} disabled={busy} onClick={() => setRefresh(value => value + 1)}>Оновити</button></div>
      <form onSubmit={submitSearch} className="mt-4 flex flex-wrap gap-2"><input aria-label="Пошук" type="search" maxLength={200} placeholder={section === 'users' ? 'Ім’я, email, місто або ID' : section === 'events' ? 'Назва, організатор або адреса' : 'Подія або причина'} value={search} onChange={e => setSearch(e.target.value)} className={`${field} min-w-0 flex-1 basis-48`} />{section === 'users' && <select aria-label="Місто учасників" value={city} onChange={e => { setCity(e.target.value); setPage(1) }} className={`${field} max-w-full`}><option value="">Усі міста</option>{[...new Set([...(data?.cities ?? []), ...(city ? [city] : [])])].map(item => <option key={item}>{item}</option>)}</select>}<button type="submit" className={button}>Знайти</button>{(query || city) && <button type="button" className={button} onClick={() => { setQuery(''); setSearch(''); setCity(''); setPage(1) }}>Скинути</button>}</form>
      <p className="mt-3 text-xs leading-5 text-brand-ink-muted">{section === 'users' ? 'Профілі ПОРУЧ, включно з тестовими. «Реєстрація» — створення профілю в ПОРУЧ. «Вхід» — остання авторизація спільного акаунту, а не останній перегляд платформи.' : section === 'events' ? 'Особисті та громадські події, зокрема за запрошенням. Скасування прибирає подію з пошуку та закриває приєднання; історія і чат зберігаються.' : 'Журнал скасувань і відновлень через адмінку. Час — Київ.'}</p>
    </div>
    {notice && <p role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {error && <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error} <button className="ml-2 underline" onClick={() => setRefresh(value => value + 1)}>Повторити</button></div>}
    {busy && <p role="status" className="py-10 text-center text-sm text-brand-ink-muted">Завантажуємо…</p>}
    {!busy && data && <>
      <div className="my-4 flex items-center justify-between text-sm"><p>Знайдено: <strong>{data.total}</strong></p><p className="text-brand-ink-muted">Сторінка {page} з {pages}</p></div>
      {data.rows.length === 0 && <div className="rounded-2xl border border-dashed border-brand-border bg-white p-10 text-center text-brand-ink-muted">Записів не знайдено.</div>}
      {section === 'users' && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(data.rows as Member[]).map(member => <article key={member.id} className="min-w-0 rounded-2xl border border-brand-border bg-white p-4">
        <div className="flex items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-accent-soft text-lg font-bold text-brand-accent">{member.avatar_url ? <img src={member.avatar_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : member.name?.charAt(0)}</div><div className="min-w-0"><Link to={`/profile/${member.id}`} className="break-words font-extrabold hover:text-brand-accent">{member.name || 'Без імені'}</Link><p className="text-xs text-brand-ink-muted">{member.city || 'Місто не вказано'}{member.age ? ` · ${member.age} років` : ''}</p></div></div>
        <p className="mt-3 break-all text-sm">{member.email || 'Вхід без email'}{member.email && <span className="ml-1 text-xs text-brand-ink-muted">{member.email_confirmed ? '✓ підтверджено' : 'не підтверджено'}</span>}</p>
        <dl className="mt-3 space-y-1 text-xs text-brand-ink-soft"><div className="flex flex-wrap justify-between gap-1"><dt>Реєстрація</dt><dd>{date(member.created_at)}</dd></div><div className="flex flex-wrap justify-between gap-1"><dt>Вхід</dt><dd>{date(member.last_sign_in_at)}</dd></div><div className="flex justify-between"><dt>Створено / бере участь</dt><dd>{member.event_count} / {member.joined_count}</dd></div></dl><p className="mt-3 break-all border-t border-brand-border pt-2 font-mono text-[10px] text-brand-ink-muted">{member.id}</p>
      </article>)}</div>}
      {section === 'events' && <div className="grid gap-3 lg:grid-cols-2">{(data.rows as AdminEvent[]).map(event => <article key={event.id} className="min-w-0 rounded-2xl border border-brand-border bg-white p-5"><div className="mb-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-lg bg-brand-accent-soft px-2 py-1 text-brand-accent">{event.event_type === 'personal' ? 'Особиста' : 'Громадська'}</span><span className={`rounded-lg px-2 py-1 ${event.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}>{statusLabels[event.status] ?? event.status}</span>{!event.is_public && <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-800">За запрошенням</span>}</div><h2 className="break-words text-lg font-extrabold">{event.title}</h2><p className="mt-1 text-sm text-brand-ink-muted">{event.organizer_name || 'Організатор'} · {date(event.event_datetime)}</p><p className="mt-2 break-words text-sm">{event.address_text}</p><details className="mt-3 text-sm"><summary className="cursor-pointer font-bold text-brand-accent">Опис та ID</summary><p className="mt-2 whitespace-pre-wrap break-words">{event.description || 'Без опису'}</p><p className="mt-2 break-all font-mono text-xs text-brand-ink-muted">{event.id}</p></details><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-brand-border pt-3"><span className="text-xs text-brand-ink-muted">Учасників: {event.participant_count}/{event.max_participants}</span>{['upcoming','active'].includes(event.status) && <button className={`${button} !text-red-700`} onClick={() => openAction(event, 'cancel')}>Скасувати подію</button>}{event.can_restore && <button className={`${button} !text-brand-accent`} onClick={() => openAction(event, 'restore')}>Відновити подію</button>}</div></article>)}</div>}
      {section === 'audit' && <div className="space-y-3">{(data.rows as Audit[]).map(item => <article key={item.id} className="rounded-2xl border border-brand-border bg-white p-4"><p className="text-xs text-brand-ink-muted">{date(item.created_at)}</p><h2 className="mt-1 font-bold">{item.action === 'cancel' ? 'Скасовано' : 'Відновлено'}: {item.event_title}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.reason}</p><p className="mt-2 text-xs text-brand-ink-muted">{statusLabels[item.previous_status]} → {statusLabels[item.next_status]}</p></article>)}</div>}
      <div className="mt-5 flex justify-center gap-3"><button className={button} disabled={page <= 1} onClick={() => setPage(value => value - 1)}>← Назад</button><button className={button} disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Далі →</button></div>
    </>}
    {action && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4" onKeyDown={e => {
      if (e.key === 'Escape') closeAction()
      if (e.key === 'Tab') {
        const elements = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),textarea'))
        const first = elements[0], last = elements[elements.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }}><section role="dialog" aria-modal="true" aria-labelledby="admin-action-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><h2 id="admin-action-title" className="text-xl font-extrabold">{action.kind === 'cancel' ? 'Скасувати подію?' : 'Відновити подію?'}</h2><p className="mt-2 break-words text-sm text-brand-ink-muted">{action.event.title}</p><form onSubmit={saveAction}><label htmlFor="admin-reason" className="mt-4 block text-sm font-bold">Причина для журналу</label><textarea ref={reasonInput} id="admin-reason" required minLength={3} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className={`${field} mt-2 min-h-24 w-full py-3`} />{saveError && <p role="alert" className="mt-2 text-sm text-red-700">{saveError}</p>}<div className="mt-4 flex justify-end gap-2"><button type="button" disabled={saving} onClick={closeAction} className={button}>Назад</button><button type="submit" disabled={saving || reason.trim().length < 3} className={`${button} !border-brand-accent !bg-brand-accent !text-white`}>{saving ? 'Зберігаємо…' : 'Підтвердити'}</button></div></form></section></div>}
  </>
}
