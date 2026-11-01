import { AnimatePresence, motion } from 'framer-motion'
import { Hourglass, Swords, WifiOff } from 'lucide-react'
import { CARD_INFO } from '../../lib/deck'
import type { PendingAttack, Player } from '../../types/game'

interface TurnIndicatorProps {
  current: Player | null
  pending: PendingAttack | null
  players: Player[]
  large?: boolean
}

/** Bandeau animé : à qui le tour, pause en cas de déconnexion, coup fourré en attente */
export function TurnIndicator({ current, pending, players, large }: TurnIndicatorProps) {
  const target = pending ? players.find((p) => p.id === pending.target_id) : null
  let key = `turn-${current?.id}`
  let tone = 'bg-signal-400 text-night-900'
  let icon = <Hourglass className="size-5 shrink-0" />
  let text = current ? (current.is_me ? 'À vous de jouer !' : `Au tour ${/^[aeiouyhàâéèêîïôû]/i.test(current.name) ? 'd’' : 'de '}${current.name}`) : 'En attente…'

  if (pending && target) {
    key = `pending-${pending.target_id}-${pending.attack}`
    tone = 'bg-flame-500 text-cream-50'
    icon = <Swords className="size-5 shrink-0" />
    text = target.is_me
      ? `${CARD_INFO[pending.attack].label} ! Coup fourré possible`
      : `${target.name} réagit à l’attaque…`
  } else if (current && !current.is_connected) {
    key = `paused-${current.id}`
    tone = 'bg-night-700 text-cream-100 ring-1 ring-flame-500/60'
    icon = <WifiOff className="size-5 shrink-0 text-flame-400" />
    text = `Partie en pause : ${current.name} est déconnecté`
  }

  return (
    <div className="relative" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={key}
          // Le nouveau tour s'affiche immédiatement (pas d'attente de l'animation de sortie)
          initial={{ y: -12, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={`flex items-center justify-center gap-2 rounded-2xl font-extrabold shadow-lg ${tone} ${
            large ? 'px-6 py-3 text-xl 2xl:px-8 2xl:py-4 2xl:text-3xl' : 'px-4 py-2.5 text-sm short:py-1.5'
          }`}
        >
          {icon}
          <span className="text-balance text-center leading-tight">{text}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
