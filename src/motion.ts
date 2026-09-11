import { useEffect, useRef, useState } from 'react'

/** Todo el sistema de movimiento se apaga si el sistema pide menos animación. */
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type RevealOptions = {
  /** Qué tanto del elemento debe verse para disparar la entrada. */
  threshold?: number
  /** Margen para adelantar la entrada antes de que el borde toque la pantalla. */
  rootMargin?: string
}

/** Entrada suave cuando el elemento aparece en pantalla. Se dispara una sola vez. */
export function useReveal<T extends HTMLElement>({ threshold = 0.14, rootMargin = '0px 0px -8% 0px' }: RevealOptions = {}) {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        setVisible(true)
        observer.disconnect()
      })
    }, { threshold, rootMargin })

    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  return { ref, visible }
}

/**
 * Parallax ligero con el puntero y el scroll.
 * Escribe dos variables CSS (--px / --py) que las capas usan a distintas intensidades.
 */
export function useParallax<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node || prefersReducedMotion()) return
    if (window.matchMedia('(hover: none)').matches) return

    let frame = 0
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0

    const render = () => {
      currentX += (targetX - currentX) * 0.08
      currentY += (targetY - currentY) * 0.08
      node.style.setProperty('--px', currentX.toFixed(3))
      node.style.setProperty('--py', currentY.toFixed(3))
      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        frame = window.requestAnimationFrame(render)
      } else {
        frame = 0
      }
    }

    const queue = () => {
      if (!frame) frame = window.requestAnimationFrame(render)
    }

    const onMove = (event: PointerEvent) => {
      const bounds = node.getBoundingClientRect()
      targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
      queue()
    }

    const onLeave = () => {
      targetX = 0
      targetY = 0
      queue()
    }

    node.addEventListener('pointermove', onMove)
    node.addEventListener('pointerleave', onLeave)
    return () => {
      node.removeEventListener('pointermove', onMove)
      node.removeEventListener('pointerleave', onLeave)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return ref
}

/** Barra de progreso de lectura pegada al borde superior. */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    let frame = 0

    const update = () => {
      frame = 0
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0
      node.style.setProperty('--progress', progress.toFixed(4))
    }

    const queue = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', queue, { passive: true })
    window.addEventListener('resize', queue)
    return () => {
      window.removeEventListener('scroll', queue)
      window.removeEventListener('resize', queue)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return ref
}

/**
 * Onda material en cada botón. La capa va dentro del botón, recortada a su radio,
 * para no tapar insignias que salen del borde.
 */
export function useRipple() {
  useEffect(() => {
    if (prefersReducedMotion()) return

    const onPointerDown = (event: PointerEvent) => {
      const origin = event.target as HTMLElement | null
      const host = origin?.closest<HTMLElement>('button, .ripple')
      if (!host || host.dataset.noRipple !== undefined) return
      if (host instanceof HTMLButtonElement && host.disabled) return

      const bounds = host.getBoundingClientRect()
      if (bounds.width > 900 || bounds.height > 900) return

      const layer = document.createElement('span')
      layer.className = 'ripple-layer'
      const dot = document.createElement('span')
      dot.className = 'ripple-dot'
      const size = Math.max(bounds.width, bounds.height) * 2.1
      dot.style.width = `${size}px`
      dot.style.height = `${size}px`
      dot.style.left = `${event.clientX - bounds.left - size / 2}px`
      dot.style.top = `${event.clientY - bounds.top - size / 2}px`
      layer.appendChild(dot)
      host.appendChild(layer)

      window.setTimeout(() => layer.remove(), 620)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [])
}

/** Marca el documento cuando el usuario ya hizo scroll, para el encabezado flotante. */
export function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [offset])

  return scrolled
}
