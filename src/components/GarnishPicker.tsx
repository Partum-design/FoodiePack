import { Check } from 'lucide-react'
import { isDoubleGarnish } from '../packages'
import type { Garnish, PackageTier } from '../packages'

const SINGLE: Array<{ value: Garnish; label: string; art: string[] }> = [
  { value: 'arroz', label: 'Arroz', art: ['🍚'] },
  { value: 'frijoles', label: 'Frijoles', art: ['🫘'] },
]

const DOUBLE: Array<{ value: Garnish; label: string; hint: string; art: string[] }> = [
  { value: 'arroz', label: '2 arroz', hint: 'Doble arroz', art: ['🍚', '🍚'] },
  { value: 'mixto', label: 'Uno y uno', hint: 'Mitad y mitad', art: ['🍚', '🫘'] },
  { value: 'frijoles', label: '2 frijoles', hint: 'Doble frijol', art: ['🫘', '🫘'] },
]

/** Side picker: one side for Económico/Ejecutivo, two sides (2+0, 1+1, 0+2) for Foodie+. */
export default function GarnishPicker({ tier, value, onChange }: {
  tier: PackageTier | null
  value: Garnish
  onChange: (value: Garnish) => void
}) {
  const double = isDoubleGarnish(tier)
  const options = double ? DOUBLE : SINGLE
  return (
    <div className="fp-garnish">
      <span className="fp-garnish__title">{double ? 'Tus 2 guarniciones' : 'Tu guarnición'}{double && <em>Foodie+</em>}</span>
      <div className={`fp-garnish__grid ${double ? 'is-double' : ''}`} role="radiogroup" aria-label={double ? 'Elige tus 2 guarniciones' : 'Elige tu guarnición'}>
        {options.map((option) => {
          const active = value === option.value
          return (
            <button
              type="button"
              key={option.value}
              role="radio"
              aria-checked={active}
              className={`fp-garnish__option ${active ? 'is-active' : ''}`}
              onClick={() => onChange(option.value)}
            >
              {active && <i className="fp-garnish__check"><Check size={12} /></i>}
              <span className="fp-garnish__art" aria-hidden="true">
                {option.art.map((emoji, index) => <b key={index} style={{ animationDelay: `${index * 80}ms` }}>{emoji}</b>)}
              </span>
              <strong>{option.label}</strong>
              {'hint' in option && <small>{(option as { hint: string }).hint}</small>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
