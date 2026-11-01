import { motion } from 'framer-motion'
import { CarFront, Flag } from 'lucide-react'
import { GOAL } from '../../lib/deck'
import { progress } from '../../lib/gameEngine'

/** Ruban de route 0 → 1 000 avec la voiture du joueur */
export function DistanceArea({ distance, color, large }: { distance: number; color: string; large?: boolean }) {
  const pct = progress(distance)
  return (
    <div className="w-full" aria-label={`${distance} bornes sur ${GOAL}`}>
      <div className={`relative w-full rounded-full bg-night-950/80 ring-1 ring-cream-100/10 ${large ? 'h-9' : 'h-6'}`}>
        <div className="absolute inset-x-3 top-1/2 h-[2px] -translate-y-1/2 road-dashes" />
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: `linear-gradient(90deg, transparent, ${color}55)` }}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 16 }}
        />
        <div className={`absolute inset-y-0 left-0 ${large ? 'right-[34px]' : 'right-6'}`}>
          <motion.div
            className="absolute top-1/2 -translate-y-1/2"
            initial={false}
            animate={{ left: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 60, damping: 14 }}
          >
            <span
              className={`grid place-items-center rounded-full border-2 border-night-900 ${large ? 'size-[34px]' : 'size-6'}`}
              style={{ background: color }}
            >
              <CarFront className={large ? 'size-5 text-night-900' : 'size-3.5 text-night-900'} strokeWidth={2.6} />
            </span>
          </motion.div>
        </div>
        <Flag className={`absolute right-2 top-1/2 -translate-y-1/2 text-cream-100/50 ${large ? 'size-4' : 'size-3'}`} />
      </div>
    </div>
  )
}
