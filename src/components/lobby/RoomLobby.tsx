import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Flag, UserX, WifiOff } from 'lucide-react'
import { useState } from 'react'
import type { GameState, Player } from '../../types/game'
import { playerColor } from '../game/PlayerStatus'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface RoomLobbyProps {
  state: GameState
  busy: boolean
  onStart: () => void
  onKick: (playerId: string) => void
}

/** Liste des joueurs en salle d'attente + lancement réservé à l'hôte */
export function RoomLobby({ state, busy, onStart, onKick }: RoomLobbyProps) {
  const { room, players } = state
  const [toKick, setToKick] = useState<Player | null>(null)
  const emptySeats = Math.max(0, room.max_players - players.length)

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold">Pilotes sur la ligne de départ</h2>
        <span className="font-display text-sm text-signal-400">
          {players.length}/{room.max_players}
        </span>
      </div>

      <ul className="flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {players.map((p) => (
            <motion.li
              key={p.id}
              layout
              initial={{ opacity: 0, x: -30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30 }}
              className="flex items-center gap-3 rounded-2xl bg-night-800 px-4 py-3 ring-1 ring-cream-100/10"
            >
              <span className="grid size-10 place-items-center rounded-full font-display text-night-900" style={{ background: playerColor(p) }}>
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex-1 truncate text-lg font-extrabold">
                {p.name}
                {p.is_me && <span className="ml-2 text-xs font-bold text-night-300">(vous)</span>}
              </span>
              {!p.is_connected && <WifiOff className="size-4 text-flame-400" aria-label="Déconnecté" />}
              {p.id === room.host_player_id ? (
                <Crown className="size-5 text-signal-400" aria-label="Hôte" />
              ) : (
                room.is_host && (
                  <button
                    type="button"
                    onClick={() => setToKick(p)}
                    aria-label={`Retirer ${p.name}`}
                    className="grid size-9 place-items-center rounded-full text-night-300 hover:bg-flame-500/15 hover:text-flame-400"
                  >
                    <UserX className="size-4" />
                  </button>
                )
              )}
            </motion.li>
          ))}
        </AnimatePresence>
        {Array.from({ length: emptySeats }).map((_, i) => (
          <li key={`empty-${i}`} className="rounded-2xl border-2 border-dashed border-cream-100/10 px-4 py-3.5 text-sm font-semibold text-night-400">
            Place libre…
          </li>
        ))}
      </ul>

      {room.is_host ? (
        <Button
          size="lg"
          variant="go"
          loading={busy}
          disabled={players.length < 2}
          onClick={onStart}
          icon={<Flag className="size-5" />}
        >
          {players.length < 2 ? 'En attente d’un 2ᵉ joueur…' : 'Lancer la partie'}
        </Button>
      ) : (
        <p className="rounded-2xl bg-night-800/70 px-4 py-3 text-center text-sm font-semibold text-night-300">
          L’hôte lancera la partie quand tout le monde sera prêt.
        </p>
      )}

      <ConfirmDialog
        open={Boolean(toKick)}
        title={`Retirer ${toKick?.name} ?`}
        confirmLabel="Retirer"
        danger
        onCancel={() => setToKick(null)}
        onConfirm={() => {
          if (toKick) onKick(toKick.id)
          setToKick(null)
        }}
      >
        Ce joueur quittera la salle.
      </ConfirmDialog>
    </div>
  )
}
