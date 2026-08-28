import type { ReactNode } from 'react'

interface HomeCarouselProps {
  id: string
  label: string
  children: ReactNode
  className?: string
}

export default function HomeCarousel({ id, label, children, className = '' }: HomeCarouselProps) {
  return (
    <div
      id={id}
      role="list"
      aria-label={label}
      data-home-carousel={id}
      className={`scrollbar-hide isolate flex min-w-0 max-w-full snap-x snap-mandatory items-stretch gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 pr-4 [scroll-padding-inline:1px] [touch-action:pan-x_pan-y] [-webkit-overflow-scrolling:touch] lg:block lg:overflow-visible lg:overscroll-auto lg:pb-0 lg:pr-0 ${className}`}
    >
      {children}
    </div>
  )
}
