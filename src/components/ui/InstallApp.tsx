import { AnimatePresence, motion } from 'framer-motion'
import { Download, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent)

/** « Installer l'application » : invite native (Android, ordinateur) ou mode d'emploi (iPhone). */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [iosHelp, setIosHelp] = useState(false)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || (!prompt && !isIos())) return null

  const install = async () => {
    if (!prompt) return setIosHelp(true)
    await prompt.prompt()
    if ((await prompt.userChoice).outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-night-800/80 px-4 text-sm font-bold ring-1 ring-cream-100/15 hover:bg-night-700"
      >
        <Download className="size-4 text-signal-400" />
        Installer l’application
      </button>

      <AnimatePresence>
        {iosHelp && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-end bg-night-950/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIosHelp(false)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm justify-self-center rounded-3xl bg-night-800 p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] ring-1 ring-cream-100/10"
            >
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setIosHelp(false)}
                className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-night-700"
              >
                <X className="size-4" />
              </button>
              <h2 className="text-lg font-extrabold">Installer sur iPhone</h2>
              <ol className="mt-3 space-y-2 text-sm text-cream-200">
                <li className="flex items-center gap-2">
                  1. Touchez <Share className="size-4 text-signal-400" /> <strong>Partager</strong> dans Safari
                </li>
                <li>
                  2. Choisissez <strong>Sur l’écran d’accueil</strong>
                </li>
                <li>3. Lancez Route 1000 comme une application, en plein écran.</li>
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
