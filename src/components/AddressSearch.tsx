import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { LoaderCircle, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { searchAddresses } from '../lib/geo'
import type { AddressSuggestion } from '../lib/geo'

/**
 * Address field with live suggestions limited to the delivery zone. Picking a suggestion
 * drops the map pin there; typing alone never moves the pin.
 */
export default function AddressSearch({ value, onChange, onPick, onLocate, locating }: {
  value: string
  onChange: (value: string) => void
  onPick: (suggestion: AddressSuggestion) => void
  onLocate: () => void
  locating: boolean
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const skipNext = useRef(false)
  const listId = useId()

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return }
    const query = value.trim()
    if (query.length < 4) { setSuggestions([]); setSearched(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchAddresses(query, controller.signal)
        setSuggestions(results)
        setSearched(true)
        setHighlight(-1)
        setOpen(true)
      } catch {
        /* aborted or offline: keep whatever is shown */
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 650)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [value])

  const pick = (suggestion: AddressSuggestion) => {
    skipNext.current = true
    onChange(suggestion.title)
    onPick(suggestion)
    setOpen(false)
    setSuggestions([])
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !suggestions.length) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((index) => (index + 1) % suggestions.length) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((index) => (index - 1 + suggestions.length) % suggestions.length) }
    if (event.key === 'Enter' && highlight >= 0) { event.preventDefault(); pick(suggestions[highlight]) }
    if (event.key === 'Escape') setOpen(false)
  }

  const showList = open && value.trim().length >= 4 && (suggestions.length > 0 || searched)

  return (
    <div className="fp-address">
      <div className="fp-address__field">
        <Search size={18} aria-hidden="true" />
        <input
          name="address"
          autoComplete="street-address"
          required
          minLength={8}
          value={value}
          onChange={(event) => { onChange(event.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          onKeyDown={onKeyDown}
          placeholder="Busca tu calle y número"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label="Dirección de entrega"
        />
        {searching && <LoaderCircle size={17} className="fp-spin" aria-label="Buscando" />}
        {!searching && value && (
          <button type="button" className="fp-address__clear" onClick={() => { onChange(''); setSuggestions([]) }} aria-label="Borrar dirección"><X size={15} /></button>
        )}
      </div>
      <button type="button" className="fp-address__locate" onClick={onLocate} disabled={locating}>
        {locating ? <LoaderCircle size={16} className="fp-spin" /> : <LocateFixed size={16} />}
        <span>{locating ? 'Ubicando…' : 'Usar mi ubicación'}</span>
      </button>
      {showList && (
        <ul className="fp-address__list" id={listId} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="option" aria-selected={highlight === index}>
              <button type="button" className={highlight === index ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => pick(suggestion)}>
                <i><MapPin size={16} /></i>
                <span><strong>{suggestion.title}</strong><small>{suggestion.subtitle}</small></span>
              </button>
            </li>
          ))}
          {suggestions.length === 0 && searched && (
            <li className="fp-address__empty">No encontramos esa calle en Lindavista. Toca el mapa para marcar tu punto.</li>
          )}
        </ul>
      )}
    </div>
  )
}
