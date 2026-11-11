import { supabase } from '@/lib/supabase'

export const EVENT_COVER_ACCEPT = 'image/jpeg,image/png,image/webp'
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function validateEventCover(file: File) {
  if (!EXTENSIONS[file.type]) throw new Error('Оберіть зображення у форматі JPG, PNG або WebP.')
  if (!file.size) throw new Error('Файл порожній. Оберіть інше зображення.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Зображення має бути не більше 5 МБ.')
}

export async function checkEventCoverImage(file: File) {
  validateEventCover(file)
  const url = URL.createObjectURL(file)
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image()
      image.onload = () => image.naturalWidth && image.naturalHeight
        ? resolve()
        : reject(new Error('Не вдалося прочитати зображення. Оберіть інший файл.'))
      image.onerror = () => reject(new Error('Не вдалося прочитати зображення. Оберіть інший файл.'))
      image.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function uploadEventCover(userId: string, file: File) {
  validateEventCover(file)
  // Reuse the existing image bucket and its owner-folder policies. Never overwrite
  // an object that might still be referenced by a saved event or another tab.
  const path = `${userId}/event-covers/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`
  const bucket = supabase.storage.from('avatars')
  const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error('Не вдалося завантажити обкладинку. Перевірте інтернет і спробуйте ще раз.')
  return bucket.getPublicUrl(path).data.publicUrl
}
