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

  // Interface optimiste : la carte jouée quitte la main tout de suite et le tour est
  // considéré comme terminé sans attendre le serveur ; tout est annulé en cas de refus.
  const [hiddenCards, setHiddenCards] = useState<string[]>([])
  const [sentTurn, setSentTurn] = useState<number | null>(null)

  const run = useCallback(
    async (fn: string, args: Record<string, unknown> = {}, optimisticCard?: string) => {
      if (!code) return false
      setBusy(true)
      setActionError(null)
      if (optimisticCard) {
        setHiddenCards((ids) => [...ids, optimisticCard])
        setSentTurn(state?.room.turn_number ?? null)
      }
      try {
        await call(fn, { code, ...args })
        await refresh()
        return true
      } catch (e) {
        if (optimisticCard) {
          setHiddenCards((ids) => ids.filter((id) => id !== optimisticCard))
          setSentTurn(null)
        }
        setActionError((e as Error).message)
        await refresh()
        return false
      } finally {
        setBusy(false)
      }
    },
    [code, refresh, state?.room.turn_number],
  )

  // Nettoyage dès que l'état serveur a pris le relais
  const serverHand = state?.me?.hand
  useEffect(() => {
    if (!serverHand) return
    setHiddenCards((ids) => {
      const kept = ids.filter((id) => serverHand.some((c) => c.id === id))
      return kept.length === ids.length ? ids : kept
    })
  }, [serverHand])
  const turnNumber = state?.room.turn_number
  useEffect(() => {
    if (sentTurn !== null && turnNumber !== sentTurn) setSentTurn(null)
  }, [turnNumber, sentTurn])

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
    hand: (serverHand ?? []).filter((c) => !hiddenCards.includes(c.id)),
    isMyTurn: Boolean(
      me && state?.room.status === 'playing' && current?.id === me.id && !pending && sentTurn === null,
    ),
    pendingForMe: Boolean(me && pending && pending.target_id === me.id),
    playCard: (cardId: string, targetId?: string) => run('playcard', { cardId, targetId: targetId ?? null }, cardId),
    discardCard: (cardId: string) => run('discardcard', { cardId }, cardId),
    respondCoupFourre: (accept: boolean) => run('respondcoupfourre', { accept }),
    startGame: () => run('startgame'),
    restartGame: () => run('restartgame'),
    kickPlayer: (playerId: string) => run('kickplayer', { playerId }),
  }
}
