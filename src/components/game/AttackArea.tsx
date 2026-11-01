import { AnimatePresence, motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'
import { ALL_SAFETIES, CARD_INFO } from '../../lib/deck'
import type { Player } from '../../types/game'
import { Card } from './Card'

/** Attaques subies (cartes rouges) — secouées à leur arrivée */
export function AttackArea({ player, size = 'sm' }: { player: Player; size?: 'xs' | 'sm' }) {
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5" aria-label="Attaques en cours">
      <AnimatePresence mode="popLayout">
        {player.attacks.length === 0 ? (
          <motion.span
            key="clear"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs font-bold text-go-400"
          >
            Route libre
          </motion.span>
        ) : (
          player.attacks.map((attack) => (
            <motion.div
              key={attack}
              layout
              initial={{ scale: 2, rotate: 20, opacity: 0 }}
              animate={{ scale: 1, rotate: [0, -8, 8, -4, 0], opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0, rotate: -30 }}
              transition={{ duration: 0.5 }}
            >
              <Card type="attack" value={attack} size={size} />
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  )
}

/** Les 4 bottes : emplacement vide ou botte posée (étoile si coup fourré) */
export function SafetyRow({ player, compact }: { player: Player; compact?: boolean }) {
  return (
    <div className="flex gap-1.5" aria-label="Bottes">
      {ALL_SAFETIES.map((safety) => {
        const owned = player.protections.includes(safety)
        const coupFourre = player.coup_fourres.includes(safety)
        const Icon = CARD_INFO[safety].icon
        return (
          <motion.div
            key={safety}
            title={`${CARD_INFO[safety].label}${coupFourre ? ' (coup fourré)' : ''}`}
            initial={false}
            animate={owned ? { scale: [1, 1.35, 1], rotate: [0, 10, 0] } : { scale: 1 }}
            transition={{ duration: 0.6 }}
            className={`relative grid place-items-center rounded-lg border-2 ${
              compact ? 'size-7' : 'size-9'
            } ${
              owned
                ? 'border-night-900 bg-signal-400 text-night-900 shadow-[0_0_14px_rgb(246_194_28/0.5)]'
                : 'border-dashed border-cream-100/15 text-cream-100/20'
            }`}
          >
            <Icon className={compact ? 'size-3.5' : 'size-4.5'} strokeWidth={2.5} />
            {coupFourre && (
              <ShieldCheck className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-flame-500 p-0.5 text-cream-50" />
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
