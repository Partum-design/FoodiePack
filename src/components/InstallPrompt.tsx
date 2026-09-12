import { useEffect, useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'

const DISMISSED_KEY = 'foodiepack:install-dismissed'

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

function isIosSafari() {
  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua)
  return isIos && isSafari
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === '1')

  useEffect(() => {
    if (isStandalone()) return

    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }
    const onInstalled = () => {
      setDeferredPrompt(null)
      setShowIosHint(false)
      localStorage.setItem(DISMISSED_KEY, '1')
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    if (isIosSafari()) setShowIosHint(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') localStorage.setItem(DISMISSED_KEY, '1')
  }

  if (dismissed) return null
  if (!deferredPrompt && !showIosHint) return null

  return (
    <div className="install-banner" role="complementary" aria-label="Instalar la app de FoodiePack">
      <div className="install-banner__logo"><img src="/favicon.png" alt="FoodiePack" /></div>
      {deferredPrompt ? (
        <>
          <p><strong>Instala FoodiePack</strong><span>Pide más rápido desde tu pantalla de inicio.</span></p>
          <button type="button" className="install-banner__cta" onClick={install}><Download size={15} /> Instalar</button>
        </>
      ) : (
        <p>
          <strong>Instala FoodiePack</strong>
          <span>Toca <Share size={11} /> Compartir y luego <SquarePlus size={11} /> Agregar a inicio.</span>
        </p>
      )}
      <button type="button" className="install-banner__close" onClick={dismiss} aria-label="Cerrar aviso de instalación"><X size={15} /></button>
    </div>
  )
}

export default InstallPrompt
