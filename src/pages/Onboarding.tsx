import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import BrandLogo from '@/components/BrandLogo'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_AVATAR_SIZE = 5 * 1024 * 1024

export default function Onboarding() {
  const navigate = useNavigate()
  const { supaUser, profile, signInAnonymously, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.name ?? supaUser?.user_metadata?.full_name?.trim() ?? '')
  const [photo, setPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const [uploadedAvatar, setUploadedAvatar] = useState<{ userId: string; url: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (!photo) return
    const objectUrl = URL.createObjectURL(photo)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Оберіть зображення JPG, PNG, WebP або GIF')
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError('Зображення має бути менше 5 МБ')
      return
    }
    setPhoto(file)
    setUploadedAvatar(null)
    setError(null)
  }

  async function continueToPoruch() {
    if (submittingRef.current) return
    const cleanName = name.trim()
    if (cleanName.length < 2) {
      setError('Вкажіть ім’я')
      return
    }
    if (cleanName.length > 80) {
      setError('Ім’я може містити до 80 символів')
      return
    }
    if (!photo && !profile?.avatar_url && !uploadedAvatar) {
      setError('Додайте фото')
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setError(null)

    try {
      const authUser = supaUser ?? await signInAnonymously()
      let avatarUrl = uploadedAvatar?.userId === authUser.id ? uploadedAvatar.url : profile?.avatar_url ?? null

      if (photo && uploadedAvatar?.userId !== authUser.id) {
        const extension = photo.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${authUser.id}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, photo, { upsert: false })
        if (uploadError) throw uploadError
        avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
        setUploadedAvatar({ userId: authUser.id, url: avatarUrl })
      }

      if (!avatarUrl) throw new Error('Avatar upload did not return a URL')

      const { error: profileError } = await supabase.from('users').upsert({
        id: authUser.id,
        name: cleanName,
        avatar_url: avatarUrl,
        google_verified: authUser.app_metadata.provider === 'google',
      })
      if (profileError) throw profileError

      await refreshProfile(authUser.id)
      navigate('/', { replace: true })
    } catch (submitError) {
      console.error('Anonymous onboarding failed', submitError)
      setError('Не вдалося створити профіль. Спробуйте ще раз')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-brand-bg px-4 py-8 text-brand-ink sm:px-6">
      <main className="w-full max-w-md rounded-3xl border border-brand-border bg-white p-6 shadow-card sm:p-8">
        <BrandLogo className="mx-auto w-40" />
        <h1 className="mt-7 text-center text-2xl font-extrabold leading-tight tracking-[-0.035em] sm:text-3xl">Знайомства та події поруч</h1>

        <div className="mt-8 space-y-6">
          <label className="block text-sm font-bold text-brand-ink-soft">Ім’я<input value={name} maxLength={80} autoComplete="name" onChange={(event) => setName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-brand-border bg-brand-bg px-4 font-normal text-brand-ink outline-none transition focus:border-brand-accent focus:bg-white focus:ring-3 focus:ring-brand-accent/10" /></label>
          <div>
            <span className="block text-sm font-bold text-brand-ink-soft">Фото</span>
            <div className="mt-3 flex flex-col items-center">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={submitting} className="group grid h-28 w-28 place-items-center overflow-hidden rounded-full border-2 border-dashed border-brand-accent/35 bg-brand-accent-soft text-brand-accent transition hover:border-brand-accent focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-brand-accent disabled:cursor-wait disabled:opacity-60" aria-label={previewUrl ? 'Замінити фото профілю' : 'Додати фото профілю'}>{previewUrl ? <img src={previewUrl} alt="Попередній перегляд фото профілю" className="h-full w-full object-cover" /> : <span className="text-3xl font-light" aria-hidden="true">+</span>}</button>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={submitting} className="mt-2 min-h-10 rounded-xl px-4 text-sm font-bold text-brand-accent transition hover:bg-brand-accent-soft disabled:cursor-wait disabled:opacity-60">{previewUrl ? 'Замінити фото' : '+ Додати фото'}</button>
              <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={selectPhoto} className="hidden" aria-label="Завантажити фото профілю" />
            </div>
          </div>
        </div>

        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <button type="button" onClick={() => { void continueToPoruch() }} disabled={submitting} className="mt-7 h-14 w-full rounded-2xl bg-brand-accent text-sm font-extrabold text-white transition hover:bg-brand-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent disabled:cursor-wait disabled:opacity-60">{submitting ? 'СТВОРЮЄМО ПРОФІЛЬ…' : 'ПРОДОВЖИТИ'}</button>
      </main>
    </div>
  )
}
