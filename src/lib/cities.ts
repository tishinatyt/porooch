export const UKRAINIAN_OBLAST_CENTERS = [
  'Вінниця',
  'Дніпро',
  'Донецьк',
  'Житомир',
  'Запоріжжя',
  'Івано-Франківськ',
  'Київ',
  'Кропивницький',
  'Луганськ',
  'Луцьк',
  'Львів',
  'Миколаїв',
  'Одеса',
  'Полтава',
  'Рівне',
  'Суми',
  'Тернопіль',
  'Ужгород',
  'Харків',
  'Херсон',
  'Хмельницький',
  'Черкаси',
  'Чернівці',
  'Чернігів',
] as const

export type UkrainianOblastCenter = (typeof UKRAINIAN_OBLAST_CENTERS)[number]

export interface CityCoordinates {
  lat: number
  lng: number
}

export const OBLAST_CENTER_COORDINATES: Record<UkrainianOblastCenter, CityCoordinates> = {
  'Вінниця': { lat: 49.2331, lng: 28.4682 },
  'Дніпро': { lat: 48.4647, lng: 35.0462 },
  'Донецьк': { lat: 48.0159, lng: 37.8029 },
  'Житомир': { lat: 50.2547, lng: 28.6587 },
  'Запоріжжя': { lat: 47.8388, lng: 35.1396 },
  'Івано-Франківськ': { lat: 48.9226, lng: 24.7111 },
  'Київ': { lat: 50.4501, lng: 30.5234 },
  'Кропивницький': { lat: 48.5079, lng: 32.2623 },
  'Луганськ': { lat: 48.574, lng: 39.3078 },
  'Луцьк': { lat: 50.7472, lng: 25.3254 },
  'Львів': { lat: 49.8397, lng: 24.0297 },
  'Миколаїв': { lat: 46.975, lng: 31.9946 },
  'Одеса': { lat: 46.4825, lng: 30.7233 },
  'Полтава': { lat: 49.5883, lng: 34.5514 },
  'Рівне': { lat: 50.6199, lng: 26.2516 },
  'Суми': { lat: 50.9077, lng: 34.7981 },
  'Тернопіль': { lat: 49.5535, lng: 25.5948 },
  'Ужгород': { lat: 48.6208, lng: 22.2879 },
  'Харків': { lat: 49.9935, lng: 36.2304 },
  'Херсон': { lat: 46.6354, lng: 32.6169 },
  'Хмельницький': { lat: 49.423, lng: 26.9871 },
  'Черкаси': { lat: 49.4444, lng: 32.0598 },
  'Чернівці': { lat: 48.2915, lng: 25.9403 },
  'Чернігів': { lat: 51.493, lng: 31.2945 },
}

// Discovery uses the same 24 oblast centres as the existing profile selector.
export interface UkrainianCity extends CityCoordinates { id: string; name: string; aliases: string[] }
const CITY_IDS: Record<UkrainianOblastCenter, string> = {
  "Вінниця": "UA05020030010063857",
  "Дніпро": "UA12020010010037010",
  "Донецьк": "UA14080030010048113",
  "Житомир": "UA18040190010057814",
  "Запоріжжя": "UA23060070010069526",
  "Івано-Франківськ": "UA26040190010045761",
  "Київ": "UA80000000000093317",
  "Кропивницький": "UA35040210010019355",
  "Луганськ": "UA44060010010012753",
  "Луцьк": "UA07080170010083384",
  "Львів": "UA46060250010015970",
  "Миколаїв": "UA48060150010035747",
  "Одеса": "UA51100270010076757",
  "Полтава": "UA53080370010073240",
  "Рівне": "UA56060470010041018",
  "Суми": "UA59080270010036634",
  "Тернопіль": "UA61040490010069060",
  "Ужгород": "UA21100230010016545",
  "Харків": "UA63120270010096107",
  "Херсон": "UA65100150010064384",
  "Хмельницький": "UA68040470010096613",
  "Черкаси": "UA71080490010015879",
  "Чернівці": "UA73060610010033137",
  "Чернігів": "UA74100390010054825"
}
const SEARCH_ALIASES: Record<UkrainianOblastCenter, string> = {
  "Вінниця": "Винница",
  "Дніпро": "Днепр",
  "Донецьк": "Донецк",
  "Житомир": "Житомир",
  "Запоріжжя": "Запорожье",
  "Івано-Франківськ": "Ивано-Франковск",
  "Київ": "Киев",
  "Кропивницький": "Кропивницкий",
  "Луганськ": "Луганск",
  "Луцьк": "Луцк",
  "Львів": "Львов",
  "Миколаїв": "Николаев",
  "Одеса": "Одесса",
  "Полтава": "Полтава",
  "Рівне": "Ровно",
  "Суми": "Сумы",
  "Тернопіль": "Тернополь",
  "Ужгород": "Ужгород",
  "Харків": "Харьков",
  "Херсон": "Херсон",
  "Хмельницький": "Хмельницкий",
  "Черкаси": "Черкассы",
  "Чернівці": "Черновцы",
  "Чернігів": "Чернигов"
}
export const UKRAINIAN_CITIES: UkrainianCity[] = UKRAINIAN_OBLAST_CENTERS.map(name => ({ id: CITY_IDS[name], name, ...OBLAST_CENTER_COORDINATES[name], aliases: [SEARCH_ALIASES[name]] }))
const byId = new Map(UKRAINIAN_CITIES.map(city => [city.id, city]))
export const DEFAULT_CITY = UKRAINIAN_CITIES.find(city => city.name === 'Чернігів')!
export function cityLabel(city: UkrainianCity) { return city.name }
export function normalizeCitySearch(value: string) {
  return value.toLocaleLowerCase('uk').normalize('NFKD').replace(/[\u0300-\u036f’'`ʼ\s.-]/g, '')
}
export function searchCities(query: string) {
  const term = normalizeCitySearch(query)
  if (!term) return UKRAINIAN_CITIES
  return UKRAINIAN_CITIES.filter(city => [city.name, ...city.aliases].some(name => normalizeCitySearch(name).includes(term)))
}
export function findCity(value: string | null | undefined): UkrainianCity | null {
  if (!value) return null
  const exact = byId.get(value) ?? UKRAINIAN_CITIES.find(city => cityLabel(city) === value)
  if (exact) return exact
  return UKRAINIAN_CITIES.find(city => normalizeCitySearch(city.name) === normalizeCitySearch(value)) ?? null
}
export function getCityCoordinates(value: string | null | undefined): CityCoordinates | null {
  const city = findCity(value)
  return city ? { lat: city.lat, lng: city.lng } : null
}
export const CITY_STORAGE_KEY = 'poruch:discovery-city'
export function readSelectedCity(storage: Pick<Storage, 'getItem'>): UkrainianCity | null {
  try { return findCity(storage.getItem(CITY_STORAGE_KEY)) } catch { return null }
}
