import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

function write(path, text) {
  fs.writeFileSync(path, text.replace(/\r\n/g, '\n'))
}

function replaceOnce(path, from, to) {
  const source = read(path)
  if (!source.includes(from)) throw new Error(`Pattern not found in ${path}: ${from.slice(0, 140)}`)
  write(path, source.replace(from, to))
}

// Home discovery: expose every supported category and apply category filtering consistently to map + feed.
replaceOnce(
  'src/pages/HomeScreen.tsx',
  `  { key: 'music',   label: 'Музика' },\n  { key: 'other',   label: 'Інше' },`,
  `  { key: 'music',   label: 'Музика' },\n  { key: 'food',    label: 'Їжа' },\n  { key: 'games',   label: 'Ігри' },\n  { key: 'walk',    label: 'Прогулянки' },\n  { key: 'art',     label: 'Мистецтво' },\n  { key: 'other',   label: 'Інше' },`,
)
replaceOnce(
  'src/pages/HomeScreen.tsx',
  `  const mapEvents = eligibleDiscovery.filter((event) =>\n    event.event_type === 'personal' || selectedCategory === 'all' || event.category === selectedCategory,\n  )`,
  `  const mapEvents = eligibleDiscovery.filter((event) =>\n    selectedCategory === 'all' || event.category === selectedCategory,\n  )`,
)

// Map should recenter/refit when the discovery center changes even if the marker set is empty/unchanged.
replaceOnce(
  'src/components/home/DiscoveryMap.tsx',
  `      const boundsKey = visibleEvents\n        .map((event) => \`${'${event.id}:${event.location_lat}:${event.location_lng}'}\`)\n        .sort()\n        .join('|')`,
  `      const markerKey = visibleEvents\n        .map((event) => \`${'${event.id}:${event.location_lat}:${event.location_lng}'}\`)\n        .sort()\n        .join('|')\n      const boundsKey = \`${'${center.lat}:${center.lng}|${markerKey}'}\``,
)

// Profile: city is part of a complete profile, so do not allow saving it blank and immediately bouncing to onboarding.
replaceOnce(
  'src/pages/Profile.tsx',
  `    if (cleanName.length < 2) { setError('Вкажіть ім’я'); return }\n    if (ageNumber !== null`,
  `    if (cleanName.length < 2) { setError('Вкажіть ім’я'); return }\n    if (!cleanCity) { setError('Оберіть місто'); return }\n    if (ageNumber !== null`,
)

// Google auth was wired in AuthContext but had no UI. Restore a returning-user entry point and reuse Google avatar metadata.
replaceOnce(
  'src/pages/Onboarding.tsx',
  `  const { supaUser, profile, signInAnonymously, refreshProfile } = useAuth()`,
  `  const { supaUser, profile, signInWithGoogle, signInAnonymously, refreshProfile } = useAuth()`,
)
replaceOnce(
  'src/pages/Onboarding.tsx',
  `  const [previewUrl, setPreviewUrl] = useState<string | null>(profile?.avatar_url ?? null)`,
  `  const [previewUrl, setPreviewUrl] = useState<string | null>(profile?.avatar_url ?? supaUser?.user_metadata?.avatar_url ?? null)`,
)
replaceOnce(
  'src/pages/Onboarding.tsx',
  `    if (!photo && !profile?.avatar_url && !uploadedAvatar) { setError('Додайте фото'); return }`,
  `    if (!photo && !profile?.avatar_url && !supaUser?.user_metadata?.avatar_url && !uploadedAvatar) { setError('Додайте фото'); return }`,
)
replaceOnce(
  'src/pages/Onboarding.tsx',
  `      let avatarUrl = uploadedAvatar?.userId === authUser.id ? uploadedAvatar.url : profile?.avatar_url ?? null`,
  `      let avatarUrl = uploadedAvatar?.userId === authUser.id ? uploadedAvatar.url : profile?.avatar_url ?? authUser.user_metadata?.avatar_url ?? null`,
)
replaceOnce(
  'src/pages/Onboarding.tsx',
  `  if (step === 'landing') return <LandingPage onStart={() => setStep('profile')} />`,
  `  if (step === 'landing') return <LandingPage onStart={() => setStep('profile')} onGoogleSignIn={() => { void signInWithGoogle().catch((signInError) => { console.error('Google sign-in failed', signInError); setError('Не вдалося увійти через Google. Спробуйте ще раз') }) }} error={error} />`,
)

replaceOnce(
  'src/components/onboarding/LandingPage.tsx',
  `export default function LandingPage({ onStart }: { onStart: () => void }) {`,
  `export default function LandingPage({ onStart, onGoogleSignIn, error }: { onStart: () => void; onGoogleSignIn: () => void; error?: string | null }) {`,
)
replaceOnce(
  'src/components/onboarding/LandingPage.tsx',
  `<header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6"><BrandLogo className="w-36 sm:w-40" /><button type="button" onClick={onStart} className="h-10 rounded-xl bg-brand-accent px-5 text-xs font-extrabold text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent">ПОЧАТИ</button></header>`,
  `<header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6"><BrandLogo className="w-32 sm:w-40" /><div className="flex items-center gap-2"><button type="button" onClick={onGoogleSignIn} className="h-10 rounded-xl border border-brand-border bg-white px-3 text-[10px] font-extrabold text-brand-ink-soft transition hover:border-brand-accent hover:text-brand-accent sm:px-4 sm:text-xs">УВІЙТИ З GOOGLE</button><button type="button" onClick={onStart} className="h-10 rounded-xl bg-brand-accent px-4 text-xs font-extrabold text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent sm:px-5">ПОЧАТИ</button></div></header>{error && <div role="alert" className="relative mx-auto mb-3 w-[calc(100%-2rem)] max-w-6xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:w-[calc(100%-3rem)]">{error}</div>}`,
)

// Create/edit event: surface DB consistency errors instead of a generic failure.
replaceOnce(
  'src/pages/CreateEvent.tsx',
  `      setErrors({ submit: eventId ? 'Не вдалося зберегти зміни. Перевірте дані та спробуйте ще раз.' : 'Не вдалося створити подію. Перевірте дані та спробуйте ще раз.' })`,
  `      const serverMessage = error?.message ?? ''\n      const submitMessage = serverMessage.includes('capacity_below_joined')\n        ? 'Кількість місць не може бути меншою за кількість уже підтверджених учасників.'\n        : serverMessage.includes('pending_requests_exist')\n          ? 'Спочатку підтвердьте або відхиліть усі заявки на участь.'\n          : eventId\n            ? 'Не вдалося зберегти зміни. Перевірте дані та спробуйте ще раз.'\n            : 'Не вдалося створити подію. Перевірте дані та спробуйте ще раз.'\n      setErrors({ submit: submitMessage })`,
)

// Private invite creation is not implemented yet. Prevent creation of new unreachable private events while preserving existing ones so they can be made public.
replaceOnce(
  'src/pages/CreateEvent.tsx',
  `                  { value: true, title: 'У стрічці', text: 'Подія з’явиться у стрічці відповідних користувачів поруч.' },\n                  { value: false, title: 'Лише за запрошенням', text: 'Подія не показуватиметься у загальній стрічці.' },`,
  `                  { value: true, title: 'У стрічці', text: 'Подія з’явиться у стрічці відповідних користувачів поруч.', disabled: false },\n                  { value: false, title: 'Лише за запрошенням', text: 'Приватні запрошення ще не підключені.', disabled: true },`,
)
replaceOnce(
  'src/pages/CreateEvent.tsx',
  `                  return <button key={String(option.value)} type="button" onClick={() => set('is_public', option.value)} aria-pressed={selected} className={\`rounded-2xl border p-3.5 text-left transition ${'${selected ? \'border-brand-accent bg-brand-accent-soft\' : \'border-brand-border bg-[#fcfcfe]\'}'}\`}><span className="flex items-center gap-2">`,
  `                  return <button key={String(option.value)} type="button" disabled={option.disabled} onClick={() => set('is_public', option.value)} aria-pressed={selected} className={\`rounded-2xl border p-3.5 text-left transition disabled:cursor-not-allowed disabled:opacity-55 ${'${selected ? \'border-brand-accent bg-brand-accent-soft\' : \'border-brand-border bg-[#fcfcfe]\'}'}\`}><span className="flex items-center gap-2">`,
)

// Approval errors: distinguish stale/finished events from generic failures.
replaceOnce(
  'src/hooks/useEvent.ts',
  `      return rpcError.message.includes('event_full') ? 'Подія вже заповнена' : decision === 'approve'\n        ? 'Не вдалося підтвердити учасника. Спробуйте ще раз'\n        : 'Не вдалося відхилити запит. Спробуйте ще раз'`,
  `      if (rpcError.message.includes('event_full')) return 'Подія вже заповнена'\n      if (rpcError.message.includes('event_unavailable')) return 'Подія вже недоступна для підтвердження нових учасників'\n      return decision === 'approve'\n        ? 'Не вдалося підтвердити учасника. Спробуйте ще раз'\n        : 'Не вдалося відхилити запит. Спробуйте ще раз'`,
)

// Keep category labels coherent wherever legacy communication records still exist.
replaceOnce(
  'src/pages/MyEvents.tsx',
  `  food: 'Їжа', games: 'Ігри', walk: 'Прогулянка', art: 'Мистецтво', other: 'Інше',`,
  `  food: 'Їжа', games: 'Ігри', walk: 'Прогулянка', art: 'Мистецтво', communication: 'Спілкування', other: 'Інше',`,
)

console.log('Audit pass 2 source fixes applied')
