import { useId } from 'react'
import { isFiestasPatrias } from '../lib/season'

const GARLAND_FLAG_COUNT = 64

export function FiestaGarland() {
  if (!isFiestasPatrias()) return null
  return (
    <div className="fiesta-garland" aria-hidden="true">
      {Array.from({ length: GARLAND_FLAG_COUNT }, (_, index) => (
        <span key={index} className={`fiesta-garland__flag fiesta-garland__flag--${(index % 4) + 1}`} />
      ))}
    </div>
  )
}

const CONFETTI_PIECES = [
  { left: '6%', top: '20%', shape: 'dot', tone: 1, delay: '0s' },
  { left: '13%', top: '64%', shape: 'bar', tone: 2, delay: '-1.6s' },
  { left: '22%', top: '38%', shape: 'dot', tone: 3, delay: '-2.8s' },
  { left: '31%', top: '76%', shape: 'square', tone: 4, delay: '-.6s' },
  { left: '40%', top: '16%', shape: 'bar', tone: 1, delay: '-3.5s' },
  { left: '49%', top: '58%', shape: 'dot', tone: 2, delay: '-2.1s' },
  { left: '58%', top: '30%', shape: 'square', tone: 3, delay: '-4.2s' },
  { left: '67%', top: '70%', shape: 'bar', tone: 4, delay: '-1.3s' },
  { left: '75%', top: '18%', shape: 'dot', tone: 1, delay: '-3.9s' },
  { left: '83%', top: '48%', shape: 'square', tone: 2, delay: '-.4s' },
  { left: '91%', top: '78%', shape: 'bar', tone: 3, delay: '-2.6s' },
  { left: '4%', top: '84%', shape: 'dot', tone: 4, delay: '-1.9s' },
  { left: '55%', top: '84%', shape: 'square', tone: 1, delay: '-3.1s' },
  { left: '95%', top: '24%', shape: 'bar', tone: 2, delay: '-.9s' },
]

export function FiestaConfetti() {
  if (!isFiestasPatrias()) return null
  return (
    <div className="fiesta-confetti" aria-hidden="true">
      {CONFETTI_PIECES.map((piece, index) => (
        <span
          key={index}
          className={`fiesta-confetti__piece fiesta-confetti__piece--${piece.shape} fiesta-confetti__piece--tone${piece.tone}`}
          style={{ left: piece.left, top: piece.top, animationDelay: piece.delay }}
        />
      ))}
    </div>
  )
}

function FiestaHornIcon() {
  const clipId = useId()
  return (
    <svg className="fiesta-horn-icon" viewBox="0 0 40 24" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d="M4,12 L32,4 A4,8 0 0 1 32,20 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect className="fiesta-horn-icon__body" x="0" y="0" width="40" height="24" />
        <rect className="fiesta-horn-icon__stripe" x="9" y="-6" width="5" height="36" transform="rotate(28 11 12)" />
        <rect className="fiesta-horn-icon__stripe" x="19" y="-6" width="5" height="36" transform="rotate(28 21 12)" />
      </g>
      <circle className="fiesta-horn-icon__mouth" cx="4" cy="12" r="3" />
      <circle className="fiesta-horn-icon__confetti fiesta-horn-icon__confetti--a" cx="35.5" cy="5.5" r="1.6" />
      <circle className="fiesta-horn-icon__confetti fiesta-horn-icon__confetti--b" cx="37.5" cy="12" r="1.8" />
      <circle className="fiesta-horn-icon__confetti fiesta-horn-icon__confetti--c" cx="35.5" cy="18.5" r="1.6" />
    </svg>
  )
}

/** Sits inline next to the special-day badge (never absolutely positioned) so it can't drift over unrelated UI. */
export function FiestaHornFlourish() {
  if (!isFiestasPatrias()) return null
  return (
    <span className="fiesta-horn-flourish" aria-hidden="true">
      <span className="fiesta-horn-flourish__side fiesta-horn-flourish__side--left"><FiestaHornIcon /></span>
      <span className="fiesta-horn-flourish__side fiesta-horn-flourish__side--right"><FiestaHornIcon /></span>
    </span>
  )
}
