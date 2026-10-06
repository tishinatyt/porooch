import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { PublicEventData } from '@/components/home/types'

type SectionKey = 'feed' | 'event' | 'circle' | 'beauty' | 'business' | 'help'

const sections: { key: SectionKey; label: string; icon: string }[] = [
  { key: 'feed', label: 'Стрічка', icon: '⌂' },
  { key: 'event', label: 'Події', icon: '▦' },
  { key: 'circle', label: 'Свої кола', icon: '♧' },
  { key: 'beauty', label: 'Б’юті', icon: '✣' },
  { key: 'business', label: 'Бізнес', icon: '▣' },
  { key: 'help', label: 'Допомога', icon: '♡' },
]

const inspiration = [
  ['Прогулянка без поспіху', 'Прогулятися містом, познайомитися та побачити звичні місця по-новому.', 'images/landing/poruch-walk.jpg', 'Створи таку зустріч'],
  ['Творчий вечір разом', 'Малювання, кераміка або нове хобі у невеликій компанії.', 'images/landing/poruch-friends.jpg', 'Створи таку зустріч'],
  ['Кава у своєму колі', 'Невелика зустріч, на яку можна прийти самій. Знайомство, теплі розмови та час для себе.', 'images/landing/poruch-coffee.jpg', 'Створи таку зустріч'],
  ['Жінки, які створюють', 'Коло про власну справу: обмін досвідом, підтримка й знайомства.', 'images/landing/poruch-friends-city.jpg', 'Твоє майбутнє коло'],
  ['Я новенька у місті', 'Знайомства з містом і людьми, корисні рекомендації та маленькі спільні плани.', 'images/landing/poruch-walk.jpg', 'Твоє майбутнє коло'],
  ['Книжкові подруги', 'Постійне коло для тих, хто любить читати та обговорювати.', 'images/landing/poruch-friends.jpg', 'Твоє майбутнє коло'],
] as const

function formatDate(value: string) {
  return new Date(value).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function SvoyaClub() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const current = (params.get('section') || 'feed') as SectionKey
  const section = sections.some((item) => item.key === current) ? current : 'feed'
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState<PublicEventData[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)

  useEffect(() => {
    if (section !== 'event') return
    let cancelled = false
    setLoadingEvents(true)

    void supabase
      .from('events')
      .select(`
        id, title, category, address_text, event_datetime, created_at, min_age, max_age, gender_filter,
        cover_photo_url, max_participants, is_public, event_type, join_mode,
        organizer:users!events_organizer_id_fkey(id, name, avatar_url, google_verified)
      `)
      .eq('is_public', true)
      .eq('status', 'upcoming')
      .order('event_datetime', { ascending: true })
      .limit(18)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[SVOYA club events]', error)
          setEvents([])
        } else {
          setEvents((data ?? []).map((row: any) => ({
            ...row,
            organizer: Array.isArray(row.organizer) ? row.organizer[0] ?? null : row.organizer,
            participant_count: 0,
            distance_km: null,
          })) as PublicEventData[])
        }
        setLoadingEvents(false)
      })

    return () => { cancelled = true }
  }, [section])

  const filteredInspiration = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('uk-UA')
    if (!q) return inspiration
    return inspiration.filter(([title, text]) => `${title} ${text}`.toLocaleLowerCase('uk-UA').includes(q))
  }, [query])

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('uk-UA')
    if (!q) return events
    return events.filter((event) =>
      [event.title, event.address_text, event.organizer?.name ?? ''].some((value) => value?.toLocaleLowerCase('uk-UA').includes(q)),
    )
  }, [events, query])

  function goSection(next: SectionKey) {
    setParams({ section: next })
  }

  return (
    <div className="min-h-screen bg-[#f6f3f0] text-[#342a2e] lg:pl-[230px]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[230px] flex-col bg-[#4d2634] px-4 py-5 text-[#f8edf0] lg:flex">
        <Link to="/" className="mb-7 px-2">
          <div className="font-[Georgia] text-[31px] tracking-[0.08em]">СВОЯ</div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#ccb7bf]">жіночий клуб</div>
        </Link>

        <p className="mb-3 px-2 text-[10px] uppercase tracking-[0.14em] text-[#c7b2ba]">Твоє місце</p>

        <nav className="space-y-1">
          {sections.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => goSection(item.key)}
              className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[12px] transition ${section === item.key ? 'bg-[#f8ecef] font-semibold text-[#4d2634]' : 'text-[#f0e4e8] hover:bg-white/7'}`}
            >
              <span className="w-4 text-center text-[15px]">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-8 border-y border-white/20 py-6">
          <div className="text-[20px]">❀</div>
          <h3 className="mt-3 font-[Georgia] text-[22px] leading-6">Можна<br />прийти самій.</h3>
          <p className="mt-3 text-[10px] leading-4 text-[#cfbcc3]">Своє коло починається з одного знайомства.</p>
          <button type="button" onClick={() => navigate('/create?type=personal')} className="mt-4 text-[10px] font-semibold underline underline-offset-4">
            Запропонувати зустріч
          </button>
        </div>

        <div className="mt-auto">
          <div className="mb-4 text-[10px] text-[#d6c6cb]">♙ &nbsp; Правила спільноти</div>
          <Link to="/profile" className="flex items-center gap-3 border-t border-white/20 pt-4">
            <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-[#7b4b5c] text-[11px] font-semibold">
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile?.name?.charAt(0) ?? 'О')}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold">{profile?.name ?? 'Олена'}</div>
              <div className="text-[9px] text-[#cdbbc1]">Мої зустрічі та профіль</div>
            </div>
          </Link>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-[#e0d6d2] bg-[#f7f4f1]/95 px-4 backdrop-blur md:px-8 lg:px-10">
        <div className="flex items-center gap-6 text-[11px] text-[#6b5960]">
          <span>⌾ &nbsp; {profile?.city || 'Усі міста'} &nbsp;⌄</span>
          <span className="hidden uppercase tracking-[0.16em] text-[#946578] md:inline">ТУТ ТИ СЕРЕД СВОЇХ</span>
        </div>
        <Link to="/" className="font-[Georgia] text-[20px] tracking-[0.08em] lg:hidden">СВОЯ</Link>
      </header>

      <main className="mx-auto w-full max-w-[1240px] px-4 py-7 md:px-8 lg:px-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a4562]">ТВОЯ СПІЛЬНОТА ПОРУЧ</p>
            <h1 className="mt-2 text-[34px] font-extrabold tracking-[-0.04em] text-[#352b2f]">{profile?.name || 'Олена'}, рада бачити.</h1>
            <p className="mt-1 text-[13px] text-[#8a7d81]">Зустрічайся. Створюй. Підтримуй. Будь собою.</p>
          </div>
          <button type="button" onClick={() => navigate('/create')} className="mt-4 hidden rounded-full bg-[#8d2f51] px-6 py-3 text-[11px] font-semibold text-white sm:inline-flex">
            ＋&nbsp; Створити
          </button>
        </div>

        <section className="mt-7 flex items-center gap-4 rounded-[15px] border border-[#e1d0d6] bg-[#f0e2e6] p-3">
          <img src={`${import.meta.env.BASE_URL}images/landing/poruch-friends.jpg`} alt="" className="h-[62px] w-[82px] rounded-[10px] object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#9c6578]">МОЖНА ПРИЙТИ САМІЙ</p>
            <div className="mt-1 font-[Georgia] text-[27px] leading-none text-[#5d3142]">Почнемо з <span className="italic text-[#a94d6b]">«привіт»?</span></div>
          </div>
          <button type="button" onClick={() => goSection('event')} className="rounded-full border border-[#d8bdc7] bg-[#fff9f7] px-4 py-2 text-[10px] text-[#6c4250]">
            Обрати зустріч
          </button>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {sections.filter((item) => item.key !== 'feed').map((item) => (
            <button key={item.key} type="button" onClick={() => goSection(item.key)} className="h-10 rounded-full border border-[#d8cac6] bg-[#fbf9f7] text-[10px] text-[#5e4650] hover:border-[#b98d9d]">
              <span className="mr-2 text-[#a13d61]">{item.icon}</span>{item.label}
            </button>
          ))}
        </div>

        <section className="mt-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-[22px] font-extrabold tracking-[-0.03em]">{section === 'feed' ? 'Життя клубу' : sections.find((item) => item.key === section)?.label}</h2>
              {section === 'feed' && (
                <div className="mt-4 flex flex-wrap gap-5 text-[10px] text-[#745e66]">
                  {sections.map((item) => (
                    <button key={item.key} type="button" onClick={() => goSection(item.key)} className={`rounded-full px-3 py-2 ${section === item.key ? 'bg-[#8d2f51] text-white' : ''}`}>
                      {item.key === 'feed' ? 'Усі' : item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9b8890]">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Пошук у клубі"
                className="h-10 w-[210px] rounded-full border border-[#ded2ce] bg-white/75 pl-9 pr-4 text-[10px] outline-none focus:border-[#a85c76]"
              />
            </div>
          </div>

          {section === 'feed' && (
            <>
              <div className="mt-5 rounded-[10px] bg-[#ece9e4] px-4 py-3 text-[10px] text-[#6f6266]">
                ❀ &nbsp; Ми збираємо перше коло. <span className="ml-2 text-[#95878c]">Реальні події та пропозиції з’являться тут після публікації учасницями.</span>
                <button type="button" onClick={() => navigate('/create?type=personal')} className="float-right underline underline-offset-3">Додати свою</button>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <h3 className="text-[17px] font-extrabold">З чого можна почати</h3>
                <p className="text-[9px] text-[#9a8c91]">Приклади форматів — запис ще не відкрито</p>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredInspiration.map(([title, text, image, action]) => (
                  <article key={title} className="rounded-[12px] border border-[#dfd4d0] bg-[#fbfaf8] p-3">
                    <div className="flex gap-3">
                      <div className="relative h-[86px] w-[106px] shrink-0 overflow-hidden rounded-[9px]">
                        <img src={`${import.meta.env.BASE_URL}${image}`} alt="" className="h-full w-full object-cover" />
                        <span className="absolute left-2 top-2 rounded bg-[#f8f0e8] px-2 py-1 text-[8px] text-[#8f665a]">Приклад</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 text-[8px] text-[#9a8b8f]"><span>⌾ Чернігів</span><span>Для натхнення</span></div>
                        <h4 className="mt-2 text-[15px] font-extrabold leading-4">{title}</h4>
                        <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-[#71666a]">{text}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-[#ece4e0] pt-3 text-[9px]">
                      <button type="button" onClick={() => navigate('/create?type=personal')} className="text-[#8e6776]">▦ &nbsp; {action}</button>
                      <button type="button" className="rounded-full border border-[#dec9d1] px-3 py-1.5 text-[#8d2f51]">Деталі</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          {section === 'event' && (
            <div className="mt-5">
              <div className="mb-4 flex items-center justify-between rounded-[10px] bg-[#eeeae5] px-4 py-3">
                <div>
                  <div className="text-[11px] font-semibold">Події клубу</div>
                  <div className="mt-1 text-[9px] text-[#8a7c81]">Реальні події з бази PORUCH/Supabase, без вигаданих записів.</div>
                </div>
                <button type="button" onClick={() => navigate('/create')} className="rounded-full bg-[#8d2f51] px-4 py-2 text-[10px] text-white">+ Створити</button>
              </div>

              {loadingEvents && <div className="py-10 text-center text-[11px] text-[#8a7c81]">Завантажуємо події…</div>}

              {!loadingEvents && filteredEvents.length === 0 && (
                <div className="rounded-[12px] border border-dashed border-[#d8cac6] bg-[#fbfaf8] px-6 py-12 text-center">
                  <h3 className="text-[17px] font-bold">Поки немає опублікованих подій</h3>
                  <p className="mt-2 text-[10px] text-[#8a7c81]">Створіть першу зустріч — вона з’явиться тут після збереження.</p>
                  <button type="button" onClick={() => navigate('/create')} className="mt-5 rounded-full bg-[#8d2f51] px-5 py-2.5 text-[10px] font-semibold text-white">Створити подію</button>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredEvents.map((event) => (
                  <button key={event.id} type="button" onClick={() => navigate(`/event/${event.id}`)} className="overflow-hidden rounded-[12px] border border-[#dfd4d0] bg-[#fbfaf8] text-left">
                    <div className="h-36 bg-[#eadfe2]">
                      {event.cover_photo_url ? <img src={event.cover_photo_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center font-[Georgia] text-[26px] text-[#8d2f51]">СВОЯ</div>}
                    </div>
                    <div className="p-4">
                      <div className="text-[8px] uppercase tracking-[0.12em] text-[#9a6578]">{formatDate(event.event_datetime)}</div>
                      <h3 className="mt-2 text-[16px] font-extrabold">{event.title}</h3>
                      <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-[#776a6f]">{event.address_text || 'Місце буде уточнено'}</p>
                      <div className="mt-4 text-[9px] font-semibold text-[#8d2f51]">Відкрити подію →</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {section !== 'feed' && section !== 'event' && (
            <div className="mt-5 rounded-[14px] border border-[#ded1cd] bg-[#fbfaf8] px-6 py-14 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9a6578]">ЕТАЛОННИЙ РОЗДІЛ</div>
              <h3 className="mx-auto mt-3 max-w-lg font-[Georgia] text-[34px] leading-9">{sections.find((item) => item.key === section)?.label}</h3>
              <p className="mx-auto mt-3 max-w-xl text-[11px] leading-5 text-[#807277]">
                Каркас і маршрут уже зафіксовані у вихідниках. Контент цього розділу не вигадуємо — переносимо після звірки з робочою версією СВОЯ.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
