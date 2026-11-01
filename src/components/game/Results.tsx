import { motion } from 'framer-motion'
import { RotateCcw, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { PLAYER_COLORS } from '../../lib/deck'
import { ranking } from '../../lib/gameEngine'
import type { GameState } from '../../types/game'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'
import { playerColor } from './PlayerStatus'

interface ResultsProps {
  state: GameState
  busy: boolean
  error?: string | null
  onRestart: () => void
  large?: boolean
}

/** Écran de victoire : podium, classement, bouton « Rejouer » (hôte) */
export function Results({ state, busy, error, onRestart, large }: ResultsProps) {
  const ranked = ranking(state)
  const winner = ranked[0]
  const reason = [...state.events].reverse().find((e) => e.action === 'finish')?.payload.reason
  const confetti = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.4 + Math.random() * 2,
        rotate: Math.random() * 720 - 360,
        color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      })),
    [],
  )

  return (
    <motion.div
      className="fixed inset-0 z-40 overflow-y-auto bg-night-950/85 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        {confetti.map((c, i) => (
          <motion.span
            key={i}
            className="absolute -top-6 block h-4 w-2 rounded-sm"
            style={{ left: `${c.left}%`, background: c.color }}
            initial={{ y: -40, rotate: 0, opacity: 1 }}
            animate={{ y: '110vh', rotate: c.rotate, opacity: [1, 1, 0.6] }}
            transition={{ duration: c.duration, delay: c.delay, ease: 'easeIn', repeat: 1 }}
          />
        ))}
      </div>

      <div className={`relative mx-auto flex min-h-full flex-col items-center justify-center gap-6 px-5 py-10 ${large ? 'max-w-2xl' : 'max-w-md'}`}>
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.15 }}
          className="grid size-24 place-items-center rounded-full bg-signal-400 text-night-900 shadow-[0_0_60px_rgb(246_194_28/0.6)]"
        >
          <Trophy className="size-12" strokeWidth={2.2} />
        </motion.div>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-center">
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-night-300">Ligne d’arrivée</div>
          <h1 className={`font-display leading-tight ${large ? 'text-6xl' : 'text-4xl'}`}>
            {winner?.is_me ? 'Vous gagnez !' : `${winner?.name} gagne !`}
          </h1>
          <p className="mt-1 font-semibold text-night-300">
            {reason === 'forfeit'
              ? 'Victoire par forfait : plus d’adversaire en course.'
              : winner?.distance === 1000
                ? '1 000 bornes pile, chapeau.'
                : 'Pioche épuisée : le plus avancé l’emporte.'}
          </p>
        </motion.div>

        <ol className="flex w-full flex-col gap-2.5">
          {ranked.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.45 + i * 0.12 }}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ${
                i === 0 ? 'bg-signal-400 text-night-900 ring-signal-300' : 'bg-night-800 ring-cream-100/10'
              }`}
            >
              <span className="w-7 font-display text-xl">{i + 1}</span>
              <span className="size-4 rounded-full ring-2 ring-night-900" style={{ background: playerColor(p) }} />
              <span className="flex-1 truncate text-lg font-extrabold">{p.name}</span>
              {p.coup_fourres.length > 0 && (
                <span className="rounded-full bg-flame-500 px-2 py-0.5 text-xs font-bold text-cream-50">
                  {p.coup_fourres.length} coup{p.coup_fourres.length > 1 ? 's' : ''} fourré{p.coup_fourres.length > 1 ? 's' : ''}
                </span>
              )}
              <span className="font-display text-xl">{p.distance}</span>
            </motion.li>
          ))}
        </ol>

        <Notice message={error ?? null} className="w-full" />
        {state.room.is_host ? (
          <Button size="lg" variant="primary" loading={busy} onClick={onRestart} icon={<RotateCcw className="size-5" />} className="w-full">
            Rejouer
          </Button>
        ) : (
          <p className="text-center text-sm font-semibold text-night-300">L’hôte peut relancer une nouvelle manche.</p>
        )}
      </div>
    </motion.div>
  )
}
