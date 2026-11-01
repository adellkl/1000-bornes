import { AnimatePresence, motion } from 'framer-motion'
import { Smartphone, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Board } from '../components/game/Board'
import { GameHeader } from '../components/game/GameHeader'
import { PauseControl } from '../components/game/PauseControl'
import { Results } from '../components/game/Results'
import { QRCodeShare } from '../components/lobby/QRCodeShare'
import { RoomLobby } from '../components/lobby/RoomLobby'
import { Button } from '../components/ui/Button'
import { FullScreenMessage } from '../components/ui/FullScreenMessage'
import { Logo } from '../components/ui/Logo'
import { Notice } from '../components/ui/Notice'
import { useGame } from '../hooks/useGame'
import { publicUrl } from '../lib/supabase'
import type { GameState } from '../types/game'

/** QR personnel de l'hôte : transfère sa place de joueur sur son téléphone */
function HostSeatShare({ state, code }: { state: GameState; code: string }) {
  const seatHere = state.players.some((p) => p.is_me && p.id === state.room.host_player_id)
  if (!seatHere || !state.room.host_claim_token) return null
  return (
    <div className="flex flex-col items-center gap-3">
      <QRCodeShare
        size={130}
        title="Vos cartes sur votre téléphone"
        caption="Scannez ce code personnel pour jouer votre main depuis votre téléphone. Ne le partagez pas."
        url={publicUrl(`/join/${code}?claim=${state.room.host_claim_token}`)}
      />
      <Link to={`/game/${code}`} className="text-xs font-bold text-night-300 underline underline-offset-4 hover:text-cream-100">
        ou jouer depuis cet ordinateur
      </Link>
    </div>
  )
}

export default function ScreenPage() {
  const { roomCode = '' } = useParams()
  const code = roomCode.toUpperCase()
  const game = useGame(code)
  const { state } = game
  const [seatOpen, setSeatOpen] = useState(false)

  if (game.loading) return <FullScreenMessage loading />
  if (!state) return <FullScreenMessage title="Salle introuvable">{game.error}</FullScreenMessage>

  const joinUrl = publicUrl(`/join/${code}`)
  const seatHere = state.players.some((p) => p.is_me && p.id === state.room.host_player_id)

  if (state.room.status === 'lobby') {
    return (
      <main className="min-h-dvh bg-table">
        <div className="mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-8 py-10 lg:grid-cols-[1.1fr_1fr]">
          <section className="flex flex-col items-center gap-8 text-center">
            <Logo size="md" />
            <div>
              <div className="text-sm font-bold uppercase tracking-[0.25em] text-night-300">Code de la salle</div>
              <motion.div
                initial={{ letterSpacing: '0.6em', opacity: 0 }}
                animate={{ letterSpacing: '0.18em', opacity: 1 }}
                className="font-display text-7xl text-signal-400 sm:text-8xl"
              >
                {code}
              </motion.div>
            </div>
            <QRCodeShare url={joinUrl} size={240} caption="Ouvrez l’appareil photo de votre téléphone et visez le code. Fonctionne en 4G comme en Wi-Fi." />
          </section>
          <section className="flex flex-col gap-6 rounded-[2rem] bg-night-900/70 p-7 ring-1 ring-cream-100/10">
            <Notice message={game.actionError} />
            <RoomLobby state={state} busy={game.busy} onStart={game.startGame} onKick={game.kickPlayer} />
            <HostSeatShare state={state} code={code} />
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh flex-col bg-table">
      <GameHeader
        code={code}
        deckCount={state.room.deck_count}
        live={game.live}
        large
        right={
          seatHere && (
            <Button variant="ghost" onClick={() => setSeatOpen(true)} icon={<Smartphone className="size-4" />}>
              Ma main
            </Button>
          )
        }
      />
      <div className="flex flex-col gap-3 px-8 pb-4 empty:hidden">
        <Notice message={game.actionError} />
        <PauseControl state={state} busy={game.busy} onKick={game.kickPlayer} />
      </div>
      <Board state={state} />

      <AnimatePresence>
        {seatOpen && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-night-950/80 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSeatOpen(false)}
          >
            <div className="relative rounded-[2rem] bg-night-800 p-8" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setSeatOpen(false)}
                className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-night-700"
              >
                <X className="size-4" />
              </button>
              <HostSeatShare state={state} code={code} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {state.room.status === 'finished' && <Results state={state} busy={game.busy} error={game.actionError} onRestart={game.restartGame} large />}
    </main>
  )
}
