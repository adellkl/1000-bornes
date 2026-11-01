import { AnimatePresence, motion } from 'framer-motion'
import { Crosshair, Trash, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CARD_INFO } from '../../lib/deck'
import { canBeAttacked, getPlayOption, statusLabel } from '../../lib/gameEngine'
import type { AttackValue, Card as CardModel, Player } from '../../types/game'
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
  /** Adversaire déjà sélectionné sur l'écran (ciblage « joueur d'abord ») */
  target: Player | null
  onClearTarget: () => void
}

/**
 * Main du joueur, fixée en bas, entièrement visible (grille, pas de défilement).
 * Toucher une carte la joue immédiatement ; la défausse passe par un mode dédié + confirmation.
 */
export function PlayerHand({ hand, me, players, canAct, busy, onPlay, onDiscard, onHint, target, onClearTarget }: PlayerHandProps) {
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
    if (card.type === 'attack') {
      // Adversaire déjà choisi : on lui envoie directement cette attaque
      if (target) {
        const check = canBeAttacked(target, card.value as AttackValue)
        if (!check.ok) return onHint(`${check.reason}. Choisissez une autre carte ou un autre adversaire.`)
        onClearTarget()
        return onPlay(card.id, target.id)
      }
      // Sinon : choix de l'adversaire visé
      if (!option.playable) return onHint(`${option.reason}. Utilisez « Défausser » si besoin.`)
      return setTargetFor(card)
    }
    if (!option.playable) return onHint(`${option.reason}. Utilisez « Défausser » si besoin.`)
    onPlay(card.id)
  }

  const isDimmed = (card: CardModel) => {
    if (!canAct || discardMode) return false
    if (target) return card.type !== 'attack' || !canBeAttacked(target, card.value as AttackValue).ok
    return !options[card.id]?.playable
  }

  return (
    <div className="shrink-0 border-t border-cream-100/10 bg-night-950/95">
      <div className="mx-auto max-w-lg px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2.5 sm:max-w-3xl short:max-w-xl short:pb-[max(env(safe-area-inset-bottom),0.5rem)] short:pt-1.5">
        <div className="mb-2 flex h-9 items-center justify-between gap-2 short:mb-1.5 short:h-8">
          {target && canAct && !discardMode ? (
            <button
              type="button"
              onClick={onClearTarget}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-flame-500 px-3 py-1.5 text-xs font-extrabold text-cream-50"
            >
              <Crosshair className="size-3.5 shrink-0" />
              <span className="truncate">Attaque contre {target.name}</span>
              <X className="size-3.5 shrink-0" />
            </button>
          ) : (
            <span className="truncate text-xs font-bold uppercase tracking-[0.18em] text-night-300">
              {discardMode ? 'Choisissez la carte' : canAct ? 'Touchez pour jouer' : 'Votre main'}
            </span>
          )}
          <button
            type="button"
            disabled={!canAct}
            onClick={() => setDiscardMode((v) => !v)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-extrabold transition-colors disabled:opacity-30 ${
              discardMode ? 'bg-flame-500 text-cream-50' : 'bg-night-800 text-cream-100 ring-1 ring-cream-100/15'
            }`}
          >
            {discardMode ? <X className="size-3.5" /> : <Trash className="size-3.5" />}
            {discardMode ? 'Annuler' : 'Défausser'}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 short:grid-cols-8 short:gap-1.5">
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
                  dimmed={isDimmed(card)}
                  className={discardMode ? 'ring-2 ring-flame-500/70' : ''}
                  onClick={() => tap(card)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {hand.length === 0 && <p className="py-6 text-center text-sm text-night-300">Aucune carte en main.</p>}
      </div>

      {/* Choix de l'adversaire visé (tous les adversaires, les impossibles sont expliqués) */}
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
              <div className="mb-4 flex items-center gap-3">
                <div className="w-12 shrink-0">
                  <Card type={targetFor.type} value={targetFor.value} size="fill" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-night-300">Attaque</div>
                  <div className="text-lg font-extrabold leading-tight">{CARD_INFO[targetFor.value].label} : qui viser ?</div>
                </div>
              </div>
              <div className="grid gap-2">
                {players
                  .filter((p) => p.id !== me.id)
                  .map((t) => {
                    const check = canBeAttacked(t, targetFor.value as AttackValue)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={!check.ok}
                        onClick={() => {
                          onPlay(targetFor.id, t.id)
                          setTargetFor(null)
                        }}
                        className="flex min-h-14 items-center gap-3 rounded-2xl bg-cream-100 px-4 text-left text-night-900 shadow-[0_4px_0_0_var(--color-cream-300)] transition-transform active:translate-y-[2px] disabled:bg-night-700 disabled:text-night-300 disabled:shadow-none"
                      >
                        <span className="size-3.5 shrink-0 rounded-full" style={{ background: playerColor(t) }} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-extrabold">{t.name}</span>
                          <span className="block text-xs font-bold opacity-70">
                            {check.ok ? statusLabel(t).label : check.reason}
                          </span>
                        </span>
                        <span className="font-display text-sm opacity-70">{t.distance}</span>
                        {check.ok && <Crosshair className="size-5 shrink-0 text-flame-500" />}
                      </button>
                    )
                  })}
              </div>
              <Button variant="ghost" className="mt-3 w-full" onClick={() => setTargetFor(null)}>
                Annuler
              </Button>
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
