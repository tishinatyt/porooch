interface BrandLogoProps {
  className?: string
  imageClassName?: string
}

export default function BrandLogo({ className = '', imageClassName = '' }: BrandLogoProps) {
  return (
    <span className={`relative inline-block aspect-[3/1] overflow-hidden ${className}`}>
      <img
        src={`${import.meta.env.BASE_URL}poruch-logo.png`}
        alt="Poruch"
        className={`absolute left-1/2 top-1/2 h-auto w-[124%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain mix-blend-multiply ${imageClassName}`}
      />
    </span>
  )
}
