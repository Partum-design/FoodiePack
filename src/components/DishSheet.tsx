import { useEffect, useState } from 'react'
import { Check, Minus, Plus, X } from 'lucide-react'
import { money } from '../lib/format'
import { isDoubleGarnish, normalizeGarnish, PACKAGE_ORDER, PACKAGES, REPEAT_GUISADO_SURCHARGE, REPEAT_GUISADO_TIER } from '../packages'
import GarnishPicker from './GarnishPicker'
import type { Garnish, PackageTier } from '../packages'
import type { Meal } from '../types'

export type DishChoice = { tier: PackageTier; quantity: number; garnish: Garnish; repeatGuisado: boolean }

/** Dish detail: pick the package (showing what each includes), garnish and quantity. */
export default function DishSheet({ meal, mode, initial, onClose, onConfirm }: {
  meal: Meal
  mode: 'day' | 'week'
  initial: Partial<DishChoice>
  onClose: () => void
  onConfirm: (choice: DishChoice) => void
}) {
  const tiers = PACKAGE_ORDER.filter((tier) => meal.packages.includes(tier))
  const [tier, setTier] = useState<PackageTier>(initial.tier && tiers.includes(initial.tier) ? initial.tier : (tiers.includes('ejecutivo') ? 'ejecutivo' : tiers[0]))
  const [quantity, setQuantity] = useState(initial.quantity || 1)
  const [garnish, setGarnish] = useState<Garnish>(() => normalizeGarnish(initial.garnish || 'arroz', tier))
  const [garnishTouched, setGarnishTouched] = useState(false)

  const pickTier = (next: PackageTier) => {
    setTier(next)
    // Foodie+ defaults to one of each side until the person picks something else.
    setGarnish((current) => (isDoubleGarnish(next) && !garnishTouched ? 'mixto' : normalizeGarnish(current, next)))
  }
  const [repeatGuisado, setRepeatGuisado] = useState(Boolean(initial.repeatGuisado))

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const pack = PACKAGES[tier]
  const canRepeat = mode === 'day' && tier === REPEAT_GUISADO_TIER
  const unit = mode === 'week' ? pack.weeklyRegular : pack.dailyPrice + (canRepeat && repeatGuisado ? REPEAT_GUISADO_SURCHARGE : 0)
  const total = unit * quantity

  return (
    <>
      <button className="fp-sheet-backdrop" aria-label="Cerrar" onClick={onClose} />
      <section className="fp-dish-sheet" role="dialog" aria-modal="true" aria-label={meal.name}>
        <div className="fp-dish-sheet__scroll">
          <div className="fp-dish-sheet__media">
            <img src={meal.image} alt={meal.name} />
            <button type="button" className="fp-icon-btn fp-dish-sheet__close" onClick={onClose} aria-label="Cerrar"><X size={19} /></button>
            {meal.tags[0] && <span className="fp-dish__badge">{meal.tags[0]}</span>}
          </div>
          <div className="fp-dish-sheet__body">
            <h2>{meal.name}</h2>
            <p className="fp-dish-sheet__desc">{meal.description}</p>

            <h3>{mode === 'week' ? 'Elige tu paquete para la semana' : 'Elige tu paquete'}</h3>
            <div className="fp-tier-list" role="radiogroup" aria-label="Paquete">
              {tiers.map((option) => {
                const item = PACKAGES[option]
                const active = option === tier
                return (
                  <button type="button" key={option} role="radio" aria-checked={active} className={`fp-tier ${active ? 'is-active' : ''}`} onClick={() => pickTier(option)}>
                    <span className="fp-tier__radio" aria-hidden="true">{active && <Check size={13} />}</span>
                    <span className="fp-tier__main">
                      <strong>{item.label}{option === 'ejecutivo' && <em>Más pedido</em>}</strong>
                      <small>{item.includes.join(' · ')}</small>
                      {active && (
                        <ul>
                          {item.includes.map((line) => <li key={line}><Check size={13} /> {line}</li>)}
                        </ul>
                      )}
                    </span>
                    <b>{money(mode === 'week' ? item.weeklyRegular : item.dailyPrice)}<small>{mode === 'week' ? '/semana' : '/día'}</small></b>
                  </button>
                )
              })}
            </div>
            {mode === 'week' && <p className="fp-hint">Pagando la semana por adelantado: {money(pack.weeklyPrepay)}. Lo eliges en tu pedido.</p>}

            <GarnishPicker tier={tier} value={garnish} onChange={(value) => { setGarnish(value); setGarnishTouched(true) }} />

            {canRepeat && (
              <label className="fp-check">
                <input type="checkbox" checked={repeatGuisado} onChange={() => setRepeatGuisado((value) => !value)} />
                <i><Check size={13} /></i>
                <span>Repetir este mismo guisado</span>
                <b>+{money(REPEAT_GUISADO_SURCHARGE)}</b>
              </label>
            )}
          </div>
        </div>

        <div className="fp-dish-sheet__foot">
          <div className="fp-counter fp-counter--lg">
            <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1} aria-label="Menos"><Minus size={16} /></button>
            <span aria-live="polite">{quantity}</span>
            <button type="button" onClick={() => setQuantity((value) => Math.min(10, value + 1))} disabled={quantity >= 10} aria-label="Más"><Plus size={16} /></button>
          </div>
          <button type="button" className="fp-btn fp-btn--primary fp-btn--lg" disabled={!meal.available} onClick={() => onConfirm({ tier, quantity, garnish, repeatGuisado: canRepeat && repeatGuisado })}>
            {meal.available ? <>Agregar · {money(total)}</> : 'Agotado'}
          </button>
        </div>
      </section>
    </>
  )
}
