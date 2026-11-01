import { AnimatePresence, motion } from 'framer-motion'
import { Trash, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CARD_INFO } from '../../lib/deck'
import { getPlayOption } from '../../lib/gameEngine'
import type { Card as CardModel, Player } from '../../types/game'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Card } from './Card'
import { playerColor } from './PlayerStatus'

interface PlayerHandProps {
  hand: CardModel[]
  me: Player
  players: Player[]
  canAct: boolean
  busy: boolean
  onPlay: (cardId: string, targetId?: string) => Promise<boolean>
  onDiscard: (cardId: string) => Promise<boolean>
  onHint: (message: string) => void
}

/**
 * Main du joueur, fixée en bas, entièrement visible (grille, pas de défilement).
 * Toucher une carte la joue immédiatement ; la défausse passe par un mode dédié + confirmation.
 */
export function PlayerHand({ hand, me, players, canAct, busy, onPlay, onDiscard, onHint }: PlayerHandProps) {
  const [discardMode, setDiscardMode] = useState(false)
  const [toDiscard, setToDiscard] = useState<CardModel | null>(null)
  const [targetFor, setTargetFor] = useState<CardModel | null>(null)
  const options = useMemo(
    () => Object.fromEntries(hand.map((c) => [c.id, getPlayOption(c, me, players)])),
    [hand, me, players],
  )

  const tap = (card: CardModel) => {
    if (busy) return
    if (!canAct) return onHint('Ce n’est pas encore votre tour.')
    if (discardMode) return setToDiscard(card)
    const option = options[card.id]
    if (!option.playable) return onHint(`${option.reason}. Utilisez « Défausser » si besoin.`)
    if (card.type === 'attack' && option.targets && option.targets.length > 1) return setTargetFor(card)
    onPlay(card.id, option.targets?.[0]?.id)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-100/10 bg-night-950/95 backdrop-blur">
      <div className="mx-auto max-w-lg px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2.5">
        <div className="mb-2 flex h-9 items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-night-300">
            {discardMode ? 'Choisissez la carte' : canAct ? 'Touchez pour jouer' : 'Votre main'}
          </span>
          <button
            type="button"
            disabled={!canAct}
            onClick={() => setDiscardMode((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-extrabold transition-colors disabled:opacity-30 ${
              discardMode ? 'bg-flame-500 text-cream-50' : 'bg-night-800 text-cream-100 ring-1 ring-cream-100/15'
            }`}
          >
            {discardMode ? <X className="size-3.5" /> : <Trash className="size-3.5" />}
            {discardMode ? 'Annuler' : 'Défausser'}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <AnimatePresence initial={false} mode="popLayout">
            {hand.map((card) => (
              <motion.div
                key={card.id}
                layout
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -80, opacity: 0, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              >
                <Card
                  type={card.type}
                  value={card.value}
                  size="fill"
                  dimmed={canAct && !discardMode && !options[card.id]?.playable}
                  className={discardMode ? 'ring-2 ring-flame-500/70' : ''}
                  onClick={() => tap(card)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {hand.length === 0 && <p className="py-6 text-center text-sm text-night-300">Aucune carte en main.</p>}
      </div>

      {/* Choix de la cible (seulement s'il y a plusieurs adversaires possibles) */}
      {createPortal(
      <AnimatePresence>
        {targetFor && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-end bg-night-950/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTargetFor(null)}
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg justify-self-center rounded-3xl bg-night-800 p-5 ring-1 ring-cream-100/10"
            >
              <div className="mb-4 text-lg font-extrabold">{CARD_INFO[targetFor.value].label} : qui viser ?</div>
              <div className="grid gap-2">
                {options[targetFor.id]?.targets?.map((t) => (
                  <Button
                    key={t.id}
                    variant="secondary"
                    className="justify-start"
                    onClick={() => {
                      onPlay(targetFor.id, t.id)
                      setTargetFor(null)
                    }}
                  >
                    <span className="size-3 rounded-full" style={{ background: playerColor(t) }} />
                    {t.name}
                    <span className="ml-auto font-display text-sm opacity-60">{t.distance}</span>
                  </Button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}

      <ConfirmDialog
        open={Boolean(toDiscard)}
        title={toDiscard ? `Défausser « ${CARD_INFO[toDiscard.value].label} » ?` : ''}
        confirmLabel="Défausser"
        danger
        onCancel={() => setToDiscard(null)}
        onConfirm={() => {
          if (toDiscard) onDiscard(toDiscard.id)
          setToDiscard(null)
          setDiscardMode(false)
        }}
      >
        La carte part à la défausse et votre tour se termine.
      </ConfirmDialog>
    </div>
  )
}
