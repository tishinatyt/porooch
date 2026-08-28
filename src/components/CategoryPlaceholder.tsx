import { Icon, type IconName } from '@/components/icons'

interface Props {
  category: string
  /** Tailwind height + width classes, e.g. "h-32 w-full" or "h-52 w-full" */
  className?: string
}

const META: Record<string, { icon: IconName; label: string }> = {
  cinema: { icon: 'film', label: 'Кіно' },
  theatre: { icon: 'theatre', label: 'Театр' },
  bar: { icon: 'martini', label: 'Бар' },
  sport: { icon: 'dumbbell', label: 'Спорт' },
  music: { icon: 'music', label: 'Музика' },
  food: { icon: 'utensils', label: 'Їжа' },
  games: { icon: 'gamepad', label: 'Ігри' },
  walk: { icon: 'footprints', label: 'Прогулянка' },
  art: { icon: 'palette', label: 'Мистецтво' },
  communication: { icon: 'users', label: 'Спілкування' },
  other: { icon: 'sparkles', label: 'Інше' },
}

export default function CategoryPlaceholder({ category, className = 'h-32 w-full' }: Props) {
  const meta = META[category] ?? META.other
  return (
    <div className={`${className} relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#ede9ff] via-[#ddd6ff] to-[#c8bcff] text-brand-accent`}>
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/25" />
      <div className="absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-brand-accent/10" />
      <div className="relative flex flex-col items-center gap-2 px-3 text-center">
        <Icon name={meta.icon} className="h-11 w-11 drop-shadow-sm" />
        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-brand-accent/75">{meta.label}</span>
      </div>
    </div>
  )
}
