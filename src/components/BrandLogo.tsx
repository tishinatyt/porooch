interface BrandLogoProps {
  className?: string
  symbolClassName?: string
  wordmarkClassName?: string
  showWordmark?: boolean
}

export default function BrandLogo({ className = '', symbolClassName = 'h-8 w-8', wordmarkClassName = '', showWordmark = true }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg aria-hidden="true" viewBox="0 0 32 32" className={`flex-none ${symbolClassName}`}>
        <rect width="32" height="32" rx="10" fill="#6846FF" />
        <circle cx="11" cy="11" r="3.25" fill="white" />
        <circle cx="21" cy="11" r="3.25" fill="white" />
        <path d="M6.5 23c.35-4 2.25-6 5.7-6 2.15 0 3.35.75 3.8 2.15.45-1.4 1.65-2.15 3.8-2.15 3.45 0 5.35 2 5.7 6" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M13.25 14.1c.85.75 1.75 1.1 2.75 1.1s1.9-.35 2.75-1.1" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity=".8" />
      </svg>
      {showWordmark && <span className={`font-extrabold tracking-[-0.045em] text-brand-ink ${wordmarkClassName}`}>porooch</span>}
    </span>
  )
}
