import { useCallback, useEffect, useMemo, useState } from 'react'
import { call } from '../lib/firebase'
import type { Player } from '../types/game'
import { useRealtimeRoom } from './useRealtimeRoom'

const HEARTBEAT_MS = 10000

/** État de la partie + actions du joueur (toutes validées côté serveur). */
export function useGame(code: string | undefined) {
  const { state, error, loading, live, refresh } = useRealtimeRoom(code)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Présence : battement de cœur régulier (détection des déconnexions côté serveur)
  useEffect(() => {
    if (!code) return
    const beat = () => call('heartbeat', { code }).catch(() => undefined)
    beat()
    const id = setInterval(beat, HEARTBEAT_MS)
    return () => clearInterval(id)
  }, [code])

  useEffect(() => {
    if (!actionError) return
    const id = setTimeout(() => setActionError(null), 3500)
    return () => clearTimeout(id)
  }, [actionError])

  const run = useCallback(
    async (fn: string, args: Record<string, unknown> = {}) => {
      if (!code) return false
      setBusy(true)
      setActionError(null)
      try {
        await call(fn, { code, ...args })
        await refresh()
        return true
      } catch (e) {
        setActionError((e as Error).message)
        await refresh()
        return false
      } finally {
        setBusy(false)
      }
    },
    [code, refresh],
  )

  const me: Player | null = useMemo(() => state?.players.find((p) => p.is_me) ?? null, [state])
  const current = useMemo(
    () => state?.players.find((p) => p.id === state.room.current_player_id) ?? null,
    [state],
  )
  const pending = state?.room.pending_attack ?? null

  return {
    state,
    loading,
    error,
    live,
    busy,
    actionError,
    setActionError,
    refresh,
    me,
    current,
    hand: state?.me?.hand ?? [],
    isMyTurn: Boolean(me && state?.room.status === 'playing' && current?.id === me.id && !pending),
    pendingForMe: Boolean(me && pending && pending.target_id === me.id),
    playCard: (cardId: string, targetId?: string) => run('playcard', { cardId, targetId: targetId ?? null }),
    discardCard: (cardId: string) => run('discardcard', { cardId }),
    respondCoupFourre: (accept: boolean) => run('respondcoupfourre', { accept }),
    startGame: () => run('startgame'),
    restartGame: () => run('restartgame'),
    kickPlayer: (playerId: string) => run('kickplayer', { playerId }),
  }
}
