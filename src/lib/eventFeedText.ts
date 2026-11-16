// Event format is independent of visibility and participation status.
export const eventFeedText = {
  public: {
    title: 'Публічні події', badge: 'Публічна', singular: 'Публічна подія',
    empty: 'Поки немає публічних подій', loading: 'Завантаження публічних подій',
    categories: 'Категорії публічних подій', more: 'Показати більше публічних подій',
  },
  personal: {
    title: 'Особисті події', badge: 'Особиста', singular: 'Особиста подія',
    empty: 'Поки немає особистих подій', loading: 'Завантаження особистих подій',
    more: 'Показати більше особистих подій',
  },
} as const
