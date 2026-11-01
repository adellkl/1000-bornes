import { AnimatePresence, motion } from 'framer-motion'
import { Swords } from 'lucide-react'
import { useEffect, useState } from 'react'
import { describeEvent } from '../../lib/gameEngine'
import type { GameEvent, GameState } from '../../types/game'
import { Card, CardBack } from './Card'
import { PlayerStatus } from './PlayerStatus'
import { TurnIndicator } from './TurnIndicator'

const CARD_EVENTS = ['play_distance', 'play_remedy', 'play_attack', 'play_safety', 'coup_fourre', 'discard']

/** Plateau global affiché sur le grand écran */
export function Board({ state }: { state: GameState }) {
  const { room, players, events } = state
  const current = players.find((p) => p.id === room.current_player_id) ?? null
  const lastCardEvent = [...events].reverse().find((e) => CARD_EVENTS.includes(e.action)) ?? null
  const [flash, setFlash] = useState<GameEvent | null>(null)

  // Flash sur la cible d'une attaque ou lors d'un coup fourré
  useEffect(() => {
    if (!lastCardEvent || !['play_attack', 'coup_fourre'].includes(lastCardEvent.action)) return
    setFlash(lastCardEvent)
    const id = setTimeout(() => setFlash(null), 2200)
    return () => clearTimeout(id)
  }, [lastCardEvent?.id])

  const cols = players.length <= 2 ? 'grid-cols-1 xl:grid-cols-2' : players.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 2xl:grid-cols-3'
  const highlightId = flash?.action === 'play_attack' ? flash.payload.target_id : flash?.player_id

  return (
    <div className="grid flex-1 gap-6 px-8 pb-8 lg:grid-cols-[1fr_340px]">
      <section className="flex flex-col gap-5">
        <TurnIndicator current={current} pending={room.pending_attack} players={players} large />
        <div className={`grid content-start gap-5 ${cols}`}>
          {players.map((p) => (
            <PlayerStatus
              key={p.id}
              player={p}
              active={p.id === room.current_player_id}
              isHost={p.id === room.host_player_id}
              highlight={p.id === highlightId}
            />
          ))}
        </div>
      </section>

      <aside className="flex flex-col gap-5">
        <div className="rounded-3xl bg-night-950/50 p-5 ring-1 ring-cream-100/10">
          <div className="flex items-end justify-around gap-4">
            <div className="flex flex-col items-center gap-2">
              <CardBack size="lg" count={room.deck_count} />
              <span className="text-xs font-bold uppercase tracking-wider text-night-300">Pioche</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="grid aspect-[5/7] w-32 place-items-center rounded-2xl border-2 border-dashed border-cream-100/15">
                <AnimatePresence mode="popLayout">
                  {lastCardEvent?.payload.card_type && lastCardEvent.payload.card_value && (
                    <motion.div key={lastCardEvent.id} exit={{ opacity: 0, scale: 0.8 }}>
                      <Card
                        type={lastCardEvent.payload.card_type}
                        value={lastCardEvent.payload.card_value}
                        size="lg"
                        animateIn
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-night-300">Dernière carte</span>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {flash && (
            <motion.div
              key={flash.id}
              initial={{ scale: 0.6, opacity: 0, rotate: -4 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-display text-lg ${
                flash.action === 'coup_fourre' ? 'bg-signal-400 text-night-900' : 'bg-flame-500 text-cream-50'
              }`}
            >
              <Swords className="size-6 shrink-0" />
              {flash.action === 'coup_fourre' ? 'Coup fourré !' : 'Attaque !'}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex min-h-0 flex-1 flex-col rounded-3xl bg-night-950/50 p-5 ring-1 ring-cream-100/10">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-night-300">Journal de bord</h2>
          <ol className="flex flex-col-reverse gap-2 overflow-hidden">
            <AnimatePresence initial={false}>
              {events.slice(-9).map((e) => (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                    e.action === 'coup_fourre'
                      ? 'bg-signal-400/20 text-signal-300'
                      : e.action === 'play_attack'
                        ? 'bg-flame-500/15 text-flame-400'
                        : 'bg-night-800/70 text-cream-100'
                  }`}
                >
                  {describeEvent(e)}
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </div>
      </aside>
    </div>
  )
}
