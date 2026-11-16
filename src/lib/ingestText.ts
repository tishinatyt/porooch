export const ingestText = {
  platform: 'Платформа', moderation: 'Афіша на модерації', sources: 'Джерела',
  publish: 'Опублікувати', reject: 'Відхилити', selectAll: 'Обрати всі на сторінці',
  city: 'Місто', allCities: 'Усі міста', source: 'Джерело', allSources: 'Усі джерела',
  empty: 'Немає подій на модерації', noSources: 'Джерел поки немає',
  loading: 'Завантажуємо…', failed: 'Не вдалося завантажити дані. Перевірте доступ та застосування SQL.',
  changed: 'Подія вже змінилася або її не можна опублікувати. Оновіть список і перевірте ще раз.',
  saved: 'Зміни збережено', refresh: 'Оновити', previous: 'Назад', next: 'Далі',
  name: 'Назва', type: 'Тип джерела', url: 'URL сторінки', category: 'Категорія за замовчуванням',
  eventCategory: 'Категорія події',
  categoryHint: 'Зміна категорії збережеться під час публікації.',
  categoryMigration: 'Для зміни категорії виконайте SQL ingested-event-category.sql, потім повторіть публікацію.',
  partner: 'Партнерські параметри (наприклад, utm_source=poruch)',
  add: 'Додати джерело', edit: 'Редагувати', save: 'Зберегти', cancel: 'Скасувати',
  enabled: 'Увімкнено', enable: 'Увімкнути', disable: 'Вимкнути',
  sourceImages: 'Показувати афіші джерела (лише за згодою джерела)',
  imagesMigration: 'Для афіш джерела спочатку виконайте SQL event-sources-images.sql. Без нього доступні обкладинки категорій.',
  moderationRequired: 'Публікація лише після модерації. Автопублікацію вимкнено.',
  invalid: 'Укажіть назву, місто та HTTPS-адресу без логіна й пароля.',
  lastRun: 'Останній запуск', result: 'Результат', counters: 'Знайдено / змінено',
  details: 'Детальніше', ticket: 'Купити квиток', from: 'від',
  externalError: 'Події з зовнішніх джерел тимчасово недоступні.',
  noCoordinates: 'без координат',
  externalMarker: 'З джерел', nativeMarker: 'Події користувачів', venueEvents: 'Події в цьому місці',
} as const

export const ingestStatusLabels: Record<string, string> = {
  EventCancelled: 'Скасовано', EventPostponed: 'Перенесено', EventRescheduled: 'Нова дата',
}
