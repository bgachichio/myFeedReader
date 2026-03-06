import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    // Check if user already dismissed this session
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Show after a short delay — don't interrupt initial load
      setTimeout(() => setShow(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    const onInstalled = () => { setShow(false); setInstalled(true) }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShow(false)
    sessionStorage.setItem('pwa-prompt-dismissed', '1')
  }

  if (!show || installed) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50
      bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700
      rounded-2xl shadow-xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
      <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
        <Download className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
          Install myFeedReader
        </p>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Add to your home screen for a full app experience — works offline too.
        </p>
        <div className="flex gap-2 mt-3">
          <button onClick={handleInstall}
            className="flex-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors">
            Install
          </button>
          <button onClick={handleDismiss}
            className="px-3 py-1.5 border border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 text-xs font-medium rounded-lg hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors">
            Not now
          </button>
        </div>
      </div>
      <button onClick={handleDismiss}
        className="text-stone-300 dark:text-stone-600 hover:text-stone-500 flex-shrink-0 -mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
