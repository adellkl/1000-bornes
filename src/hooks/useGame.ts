import { useCallback, useEffect, useMemo, useState } from 'react'
import { rpc } from '../lib/supabase'
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
    const beat = () => rpc('heartbeat', { p_code: code }).catch(() => undefined)
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
        await rpc(fn, { p_code: code, ...args })
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
    playCard: (cardId: string, targetId?: string) =>
      run('play_card', { p_card_id: cardId, p_target_id: targetId ?? null }),
    discardCard: (cardId: string) => run('discard_card', { p_card_id: cardId }),
    respondCoupFourre: (accept: boolean) => run('respond_coup_fourre', { p_accept: accept }),
    startGame: () => run('start_game'),
    restartGame: () => run('restart_game'),
    kickPlayer: (playerId: string) => run('kick_player', { p_player_id: playerId }),
  }
}
