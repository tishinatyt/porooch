export type Gender = 'male' | 'female' | 'any'

export interface User {
  id: string
  name: string
  age: number
  gender: Gender
  avatar_url: string | null
  google_verified: boolean
  city: string | null
  bio: string | null
  interests: string[]
  created_at: string
}
