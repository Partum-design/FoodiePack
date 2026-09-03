import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, Calendar, Check, Loader2, MessageCircle, Minus, Plus, RefreshCw, Wand2,
} from 'lucide-react'
import { getMenu, getMenuDays } from './api'
import FloatingDecor from './components/FloatingDecor'
import Logo from './components/Logo'
import { dayName, fullDate, shortDate } from './lib/dates'
import { money } from './lib/format'
import { useReveal } from './lib/useReveal'
import { PACKAGE_ORDER, PACKAGES } from './packages'
import type { PackageTier } from './packages'
import type { Meal, MenuDay, MenuResponse, OrderPolicy } from './types'

// Mexico City mobile number for FoodiePack's WhatsApp line.
const WHATSAPP_NUMBER = '5215660356369'

function buildWhatsAppUrl(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

function DayCard({ day, meals, selectedMealId, onChoose }: {
  day: MenuDay
  meals: Meal[]
  selectedMealId: string | null
  onChoose: (mealId: string) => void
}) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  const done = Boolean(selectedMealId)
  return (
    <div ref={ref} className={`week-day reveal ${visible ? 'reveal--visible' : ''}`}>
      <div className="week-day__head">
        <div>
          <strong>{dayName(day.date, true)}</strong>
          <span>{fullDate(day.date)}</span>
        </div>
        {done && <b className="week-day__check"><Check size={12} /> Listo</b>}
      </div>
      <div className="week-day__meals">
        {meals.map((meal) => (
          <button
            type="button"
            key={meal.id}
            className={`week-meal-card ${selectedMealId === meal.id ? 'selected' : ''} ${!meal.available ? 'unavailable' : ''}`}
            disabled={!meal.available}
            onClick={() => onChoose(meal.id)}
          >
            <span className="week-meal-card__media">
              <img src={meal.image} alt="" loading="lazy" decoding="async" />
              {selectedMealId === meal.id && <i className="week-meal-card__badge"><Check size={13} /></i>}
              {!meal.available && <em>Agotado</em>}
            </span>
            <b>{meal.name}</b>
          </button>
        ))}
        {meals.length === 0 && <p className="week-day__empty">La cocina todavía no publica el menú de este día.</p>}
      </div>
    </div>
  )
}

function WeekMenuApp() {
  const [days, setDays] = useState<MenuDay[]>([])
  const [policy, setPolicy] = useState<OrderPolicy | null>(null)
  const [menus, setMenus] = useState<Record<string, MenuResponse>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryTick, setRetryTick] = useState(0)
  const [packageTier, setPackageTier] = useState<PackageTier>('ejecutivo')
  const [quantity, setQuantity] = useState(1)
  const [selections, setSelections] = useState<Record<string, string>>({})

  useEffect(() => {
    document.title = 'FoodiePack · Menú de la semana'
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    getMenuDays()
      .then(({ days: availableDays, policy: currentPolicy }) => {
        if (!active) return null
        setDays(availableDays)
        setPolicy(currentPolicy)
        return Promise.all(availableDays.map((day) => getMenu(day.date).then((response) => [day.date, response] as const)))
      })
      .then((entries) => {
        if (!active || !entries) return
        setMenus(Object.fromEntries(entries))
      })
      .catch(() => { if (active) setError('No pudimos cargar el menú de la semana. Intenta de nuevo.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retryTick])

  const pack = PACKAGES[packageTier]
  const totalDays = days.length
  const selectedCount = useMemo(
    () => days.filter((day) => selections[day.date]).length,
    [days, selections],
  )

  const changeQuantity = (change: number) => setQuantity((current) => Math.min(10, Math.max(1, current + change)))

  const chooseMeal = (date: string, mealId: string) => {
    setSelections((current) => {
      const next = { ...current }
      if (next[date] === mealId) delete next[date]
      else next[date] = mealId
      return next
    })
  }

  const autoFillWeek = () => {
    setSelections((current) => {
      const next = { ...current }
      days.forEach((day) => {
        if (next[day.date]) return
        const meals = menus[day.date]?.meals || []
        const pick = meals.find((meal) => meal.available)
        if (pick) next[day.date] = pick.id
      })
      return next
    })
  }

  const whatsappMessage = useMemo(() => {
    const lines: string[] = []
    lines.push('¡Hola! 👋 Quiero armar mi semana con FoodiePack:')
    lines.push('')
    lines.push(`📦 Paquete: ${pack.label} (${money(pack.dailyPrice)}/día)`)
    lines.push(`👥 Para: ${quantity} ${quantity === 1 ? 'persona' : 'personas'}`)
    lines.push('')
    days.forEach((day) => {
      const meal = menus[day.date]?.meals.find((item) => item.id === selections[day.date])
      const weekday = dayName(day.date, true)
      lines.push(`🗓️ ${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${shortDate(day.date)}: ${meal ? meal.name : 'Sorpréndanme con el guisado del día'}`)
    })
    lines.push('')
    lines.push('Quedo al pendiente para confirmar dirección, horario y forma de pago. ¡Gracias! 🙌')
    return lines.join('\n')
  }, [pack, quantity, days, menus, selections])

  const whatsappHref = buildWhatsAppUrl(whatsappMessage)

  return (
    <div className="week-menu-page">
      <header className="week-menu-page__header">
        <a href="/" aria-label="Ir a la tienda de FoodiePack"><Logo horizontal /></a>
        <a className="week-menu-page__back" href="/">‹ Tienda principal</a>
      </header>

      <section className="week-hero-wrap">
        <FloatingDecor />
        <div className="week-hero">
          <span className="week-hero__badge"><Calendar size={13} /> Menú de la semana</span>
          <h1>Arma tu semana <em>en 3 toques.</em></h1>
          <p>Elige tu paquete, tu comida de cada día y te dejamos el mensaje de WhatsApp listo para enviar. Nosotros confirmamos el resto contigo.</p>
        </div>
      </section>

      <div className="week-menu-page__body">
      {error && (
        <div className="inline-error week-menu-page__error">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryTick((tick) => tick + 1)}><RefreshCw size={13} /> Reintentar</button>
        </div>
      )}

      <section className="week-block" aria-labelledby="week-package-title">
        <div className="week-block__head">
          <span className="week-step">1</span>
          <h2 id="week-package-title">Elige tu paquete</h2>
        </div>
        <div className="week-package-grid">
          {PACKAGE_ORDER.map((tier) => {
            const option = PACKAGES[tier]
            const selected = packageTier === tier
            return (
              <button
                type="button"
                key={tier}
                className={`week-package-card ${selected ? 'selected' : ''} ${tier === 'ejecutivo' ? 'popular' : ''}`}
                onClick={() => setPackageTier(tier)}
              >
                {tier === 'ejecutivo' && <span className="week-package-card__badge">Más pedido</span>}
                <b>{option.label}</b>
                <strong>{money(option.dailyPrice)}<small>/día</small></strong>
                <p>{option.includes[0]}</p>
                <span className="week-package-card__pick">{selected ? <><Check size={13} /> Elegido</> : 'Elegir'}</span>
              </button>
            )
          })}
        </div>
        <div className="week-quantity">
          <span>¿Para cuántas personas es el pedido?</span>
          <div className="counter counter--lg">
            <button type="button" onClick={() => changeQuantity(-1)} aria-label="Quitar una persona"><Minus size={14} /></button>
            <span>{quantity}</span>
            <button type="button" onClick={() => changeQuantity(1)} aria-label="Agregar una persona"><Plus size={14} /></button>
          </div>
        </div>
      </section>

      <section className="week-block" aria-labelledby="week-days-title">
        <div className="week-block__head">
          <span className="week-step">2</span>
          <h2 id="week-days-title">Elige tu comida de cada día</h2>
        </div>
        <button type="button" className="week-autofill" onClick={autoFillWeek} disabled={loading || totalDays === 0}>
          <Wand2 size={16} /> Elegir toda la semana automáticamente
        </button>
        <p className="week-autofill-hint">Te llenamos los 5 días con un toque. Si quieres cambiar algún platillo, solo tócalo.</p>

        {loading && <div className="week-days__loading"><Loader2 size={22} className="spin" /> Cargando el menú de la semana…</div>}

        <div className="week-days">
          {!loading && days.map((day) => (
            <DayCard
              key={day.date}
              day={day}
              meals={menus[day.date]?.meals || []}
              selectedMealId={selections[day.date] || null}
              onChoose={(mealId) => chooseMeal(day.date, mealId)}
            />
          ))}
        </div>
      </section>

      </div>

      <div className="week-menu-page__spacer" />

      <div className="week-summary-bar">
        <div className="week-summary-bar__info">
          <strong>{pack.label} · {quantity} {quantity === 1 ? 'persona' : 'personas'}</strong>
          <span>{selectedCount}/{totalDays || 5} días elegidos {policy && !policy.isOpen ? '· pedidos cerrados por ahora' : ''}</span>
        </div>
        <a className="week-summary-bar__cta" href={whatsappHref} target="_blank" rel="noreferrer">
          <MessageCircle size={18} /> Enviar por WhatsApp <ArrowRight size={16} />
        </a>
      </div>
    </div>
  )
}

export default WeekMenuApp
