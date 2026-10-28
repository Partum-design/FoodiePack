import { useSyncExternalStore } from 'react'
import { trackEvent } from './analytics'

// One shared install state for the whole page, so the floating banner and the
// "Descarga la app" section stay in sync. The browser fires `beforeinstallprompt`
// once, often before React mounts, so we start listening at import time.

export type InstallPlatform = 'native' | 'ios' | 'manual'

type InstallState = {
  installed: boolean
  prompt: BeforeInstallPromptEvent | null
  guideOpen: boolean
}

let state: InstallState = { installed: false, prompt: null, guideOpen: false }
const listeners = new Set<() => void>()

function setState(patch: Partial<InstallState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function isIos() {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

if (typeof window !== 'undefined') {
  state = { ...state, installed: isStandalone() }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    setState({ prompt: event })
  })
  window.addEventListener('appinstalled', () => {
    trackEvent('pwa_install')
    setState({ installed: true, prompt: null, guideOpen: false })
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstall() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state)
  const platform: InstallPlatform = snapshot.prompt ? 'native' : (isIos() ? 'ios' : 'manual')

  const install = async (source: string) => {
    trackEvent('pwa_install_click', { source, platform })
    if (snapshot.prompt) {
      const prompt = snapshot.prompt
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      setState({ prompt: null })
      if (outcome === 'accepted') setState({ installed: true })
      return
    }
    setState({ guideOpen: true })
  }

  return {
    installed: snapshot.installed,
    platform,
    guideOpen: snapshot.guideOpen,
    install,
    closeGuide: () => setState({ guideOpen: false }),
  }
}
