import { AnimatePresence, motion } from 'framer-motion'
import { Swords } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Card } from '../components/game/Card'
import { GameHeader } from '../components/game/GameHeader'
import { PauseControl } from '../components/game/PauseControl'
import { PlayerHand } from '../components/game/PlayerHand'
import { PlayerStatus } from '../components/game/PlayerStatus'
import { Results } from '../components/game/Results'
import { TurnIndicator } from '../components/game/TurnIndicator'
import { Button } from '../components/ui/Button'
import { FullScreenMessage } from '../components/ui/FullScreenMessage'
import { Notice } from '../components/ui/Notice'
import { useGame } from '../hooks/useGame'
import { CARD_INFO, SAFETY_FOR } from '../lib/deck'
import type { PendingAttack } from '../types/game'

function useCountdown(expiresAt: string | undefined, serverTime: string | undefined) {
  const offset = useRef(0)
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (serverTime) offset.current = Date.parse(serverTime) - Date.now()
  }, [serverTime])
  useEffect(() => {
    if (!expiresAt) return
    const tick = () => setLeft(Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now() - offset.current) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [expiresAt])
  return left
}

function CoupFourreDialog({
  pending,
  serverTime,
  busy,
  onRespond,
}: {
  pending: PendingAttack
  serverTime: string
  busy: boolean
  onRespond: (accept: boolean) => void
}) {
  const left = useCountdown(pending.expires_at, serverTime)
  const safety = SAFETY_FOR[pending.attack]
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-flame-700/80 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.7, rotate: -6 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="flex w-full max-w-sm flex-col items-center gap-5 rounded-[2rem] bg-night-900 p-6 text-center ring-4 ring-signal-400 short:gap-2 short:p-4"
      >
        <div className="flex items-center gap-2 font-display text-flame-400">
          <Swords className="size-5" /> Attaque : {CARD_INFO[pending.attack].label}
        </div>
        <div className="flex items-center gap-4">
          <Card type="attack" value={pending.attack} size="md" />
          <span className="font-display text-2xl text-night-300">→</span>
          <Card type="safety" value={safety} size="md" animateIn />
        </div>
        <div>
          <h2 className="font-display text-3xl text-signal-400">Coup fourré ?</h2>
          <p className="mt-1 text-sm text-cream-200">
            Jouez votre {CARD_INFO[safety].label} : l’attaque est annulée, vous piochez une carte de plus et vous rejouez.
          </p>
        </div>
        <div className="font-display text-4xl tabular-nums" aria-label={`${left} secondes`}>
          {left}
          <span className="ml-1 font-sans text-lg font-extrabold text-night-300">sec</span>
        </div>
        <div className="grid w-full gap-3">
          <Button size="lg" variant="primary" loading={busy} onClick={() => onRespond(true)}>
            Coup fourré !
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => onRespond(false)}>
            Laisser passer
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function GamePage() {
  const { roomCode = '' } = useParams()
  const code = roomCode.toUpperCase()
  const game = useGame(code)
  const { state, me, isMyTurn } = game
  const wasMyTurn = useRef(false)

  // Petite vibration quand c'est à nous
  useEffect(() => {
    if (isMyTurn && !wasMyTurn.current) navigator.vibrate?.(120)
    wasMyTurn.current = isMyTurn
  }, [isMyTurn])

  if (game.loading) return <FullScreenMessage loading />
  if (!state) return <FullScreenMessage title="Salle introuvable">{game.error}</FullScreenMessage>
  if (!state.me || !me) return <Navigate to={`/join/${code}`} replace />
  if (state.room.status === 'lobby') return <Navigate to={`/lobby/${code}`} replace />

  const opponents = state.players.filter((p) => !p.is_me)
  const pending = state.room.pending_attack

  return (
    <main className="flex h-app flex-col overflow-hidden bg-asphalt">
      <GameHeader code={code} deckCount={state.room.deck_count} live={game.live} />

      {/* Zone centrale défilante : jamais masquée par la main */}
      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto overscroll-contain">
          <div className="mx-auto grid max-w-lg grid-cols-1 gap-3 px-3 pb-4 sm:max-w-3xl md:grid-cols-2 md:items-start short:max-w-none short:grid-cols-2 short:gap-2">
            <div className="flex flex-col gap-3 md:col-span-2 short:col-span-2 short:gap-2">
              <TurnIndicator current={game.current} pending={pending} players={state.players} />
              <PauseControl state={state} busy={game.busy} onKick={game.kickPlayer} />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-night-300">Vous</h2>
              <PlayerStatus player={me} variant="compact" active={isMyTurn} isHost={me.id === state.room.host_player_id} />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-night-300">Adversaires</h2>
              {opponents.map((p) => (
                <PlayerStatus
                  key={p.id}
                  player={p}
                  variant="compact"
                  active={p.id === state.room.current_player_id}
                  isHost={p.id === state.room.host_player_id}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-40 mx-auto max-w-lg">
          <Notice message={game.actionError} />
        </div>
      </div>

      <PlayerHand
        hand={game.hand}
        me={me}
        players={state.players}
        canAct={isMyTurn}
        busy={game.busy}
        onPlay={game.playCard}
        onDiscard={game.discardCard}
        onHint={game.setActionError}
      />

      <AnimatePresence>
        {game.pendingForMe && pending && (
          <CoupFourreDialog
            key={pending.expires_at}
            pending={pending}
            serverTime={state.server_time}
            busy={game.busy}
            onRespond={game.respondCoupFourre}
          />
        )}
      </AnimatePresence>

      {state.room.status === 'finished' && <Results state={state} busy={game.busy} error={game.actionError} onRestart={game.restartGame} />}
    </main>
  )
}
