import { useId } from 'react'
import { isFiestasPatrias } from '../lib/season'

export function FiestaGarland() {
  if (!isFiestasPatrias()) return null
  return (
    <div className="fiesta-garland" aria-hidden="true">
      {Array.from({ length: 13 }, (_, index) => (
        <span key={index} className={`fiesta-garland__flag fiesta-garland__flag--${(index % 3) + 1}`} />
      ))}
    </div>
  )
}

export function FiestaConfetti() {
  if (!isFiestasPatrias()) return null
  return (
    <div className="fiesta-confetti" aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => (
        <span key={index} className={`fiesta-confetti__piece fiesta-confetti__piece--${index + 1}`} />
      ))}
    </div>
  )
}

function FiestaHorn({ className }: { className: string }) {
  const clipId = useId()
  return (
    <svg className={`fiesta-horns__horn ${className}`} viewBox="0 0 44 22">
      <defs>
        <clipPath id={clipId}>
          <polygon points="3,11 42,2 42,20" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect className="fiesta-horns__body" x="0" y="0" width="44" height="22" />
        <rect className="fiesta-horns__stripe" x="9" y="-6" width="6" height="34" transform="rotate(24 12 11)" />
        <rect className="fiesta-horns__stripe" x="22" y="-6" width="6" height="34" transform="rotate(24 25 11)" />
      </g>
      <circle className="fiesta-horns__mouth" cx="3" cy="11" r="3" />
      <circle className="fiesta-horns__dot" cx="42" cy="3.5" r="2.2" />
      <circle className="fiesta-horns__dot" cx="42" cy="11" r="2.4" />
      <circle className="fiesta-horns__dot" cx="42" cy="18.5" r="2.2" />
    </svg>
  )
}

export function FiestaHorns() {
  if (!isFiestasPatrias()) return null
  return (
    <div className="fiesta-horns" aria-hidden="true">
      <FiestaHorn className="fiesta-horns__horn--left" />
      <FiestaHorn className="fiesta-horns__horn--right" />
    </div>
  )
}
