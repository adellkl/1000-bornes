import { motion } from 'framer-motion'
import { Crown, Layers, WifiOff } from 'lucide-react'
import { CARD_INFO, PLAYER_COLORS } from '../../lib/deck'
import { statusLabel } from '../../lib/gameEngine'
import type { Player } from '../../types/game'
import { AttackArea, SafetyRow } from './AttackArea'
import { DistanceArea } from './DistanceArea'

interface PlayerStatusProps {
  player: Player
  active?: boolean
  isHost?: boolean
  variant?: 'screen' | 'compact'
  onClick?: () => void
  highlight?: boolean
}

const TONES = {
  go: 'bg-go-500/20 text-go-400 ring-go-500/40',
  slow: 'bg-signal-400/15 text-signal-300 ring-signal-400/40',
  stop: 'bg-flame-500/20 text-flame-400 ring-flame-500/40',
}

export function playerColor(player: Player) {
  return PLAYER_COLORS[player.position % PLAYER_COLORS.length]
}

/** Carte de profil d'un joueur : prénom, distance, attaques, bottes */
export function PlayerStatus({ player, active, isHost, variant = 'screen', onClick, highlight }: PlayerStatusProps) {
  const status = statusLabel(player)
  const color = playerColor(player)
  const large = variant === 'screen'

  if (!large) return <CompactStatus player={player} active={active} isHost={isHost} />

  return (
    <motion.div
      layout
      onClick={onClick}
      animate={{ scale: active && large ? 1.02 : 1 }}
      className={`relative overflow-hidden rounded-3xl bg-night-800/90 ring-1 transition-shadow ${
        active ? 'ring-2 ring-signal-400 shadow-[0_0_0_6px_rgb(246_194_28/0.12),0_20px_50px_-20px_rgb(246_194_28/0.45)]' : 'ring-cream-100/10'
      } ${highlight ? 'ring-2 ring-flame-500' : ''} ${large ? 'p-5' : 'p-3.5'} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`grid shrink-0 place-items-center rounded-full font-display text-night-900 ${large ? 'size-11 text-lg' : 'size-8 text-sm'}`}
            style={{ background: color }}
          >
            {player.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`truncate font-extrabold ${large ? 'text-xl' : 'text-base'}`}>{player.name}</span>
              {isHost && <Crown className="size-4 shrink-0 text-signal-400" aria-label="Hôte" />}
              {player.is_me && <span className="rounded bg-cream-100/10 px-1.5 text-[0.65rem] font-bold">vous</span>}
            </div>
            <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-extrabold ring-1 ${TONES[status.tone]}`}>
              {status.label}
            </span>
          </div>
        </div>
        <div className="text-right">
          <motion.div
            key={player.distance}
            initial={{ scale: 1.4, color: '#f6c21c' }}
            animate={{ scale: 1, color: '#f4ead5' }}
            className={`font-display leading-none ${large ? 'text-4xl' : 'text-2xl'}`}
          >
            {player.distance}
          </motion.div>
          <div className="text-[0.65rem] font-bold uppercase tracking-wider text-night-300">bornes</div>
        </div>
      </div>

      <div className={large ? 'mt-4' : 'mt-3'}>
        <DistanceArea distance={player.distance} color={color} large={large} />
      </div>

      <div className={`flex items-end justify-between gap-3 ${large ? 'mt-4' : 'mt-3'}`}>
        <AttackArea player={player} size={large ? 'sm' : 'xs'} />
        <SafetyRow player={player} compact={!large} />
      </div>

      <div className="mt-3 flex items-center gap-3 text-[0.7rem] font-bold text-night-300">
        <span className="inline-flex items-center gap-1">
          <Layers className="size-3.5" /> {player.hand_count} cartes
        </span>
        <span>200 joués : {player.count_200}/2</span>
        {!player.is_connected && (
          <span className="ml-auto inline-flex items-center gap-1 text-flame-400">
            <WifiOff className="size-3.5" /> Déconnecté
          </span>
        )}
      </div>
    </motion.div>
  )
}

const PILL_TONES = {
  go: 'text-go-400',
  slow: 'text-signal-300',
  stop: 'text-flame-400',
}

/** Version mobile : une ligne sobre par joueur */
function CompactStatus({ player, active, isHost }: { player: Player; active?: boolean; isHost?: boolean }) {
  const status = statusLabel(player)
  const color = playerColor(player)
  const limited = player.attacks.includes('limite') && status.tone === 'stop'
  return (
    <motion.div
      layout
      className={`rounded-2xl bg-night-800/80 px-3.5 py-3 ring-1 transition-shadow ${
        active ? 'ring-2 ring-signal-400' : 'ring-cream-100/10'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full font-display text-sm text-night-900" style={{ background: color }}>
          {player.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-extrabold">{player.name}</span>
            {isHost && <Crown className="size-3.5 shrink-0 text-signal-400" aria-label="Hôte" />}
            {player.is_me && <span className="text-[0.65rem] font-bold text-night-300">vous</span>}
            {!player.is_connected && <WifiOff className="size-3.5 text-flame-400" aria-label="Déconnecté" />}
          </div>
          <div className={`text-xs font-bold ${PILL_TONES[status.tone]}`}>
            {status.label}
            {limited && <span className="text-signal-300"> · limité à 50</span>}
          </div>
        </div>
        <div className="flex gap-1">
          {player.protections.map((s) => {
            const Icon = CARD_INFO[s].icon
            return (
              <span key={s} title={CARD_INFO[s].label} className="grid size-6 place-items-center rounded-md bg-signal-400 text-night-900">
                <Icon className="size-3.5" strokeWidth={2.5} />
              </span>
            )
          })}
        </div>
        <motion.span
          key={player.distance}
          initial={{ scale: 1.3 }}
          animate={{ scale: 1 }}
          className="w-14 text-right font-display text-xl leading-none"
        >
          {player.distance}
        </motion.span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-night-950">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={false}
          animate={{ width: `${(player.distance / 1000) * 100}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 16 }}
        />
      </div>
    </motion.div>
  )
}
