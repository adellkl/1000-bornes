import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { call } from '../lib/firebase'
import { predictNextPlayer } from '../lib/gameEngine'
import type { Player } from '../types/game'
import { useRealtimeRoom } from './useRealtimeRoom'

const HEARTBEAT_MS = 10000

/** État de la partie + actions du joueur (toutes validées côté serveur). */
export function useGame(code: string | undefined) {
  const { state, error, loading, live, refresh, announce } = useRealtimeRoom(code)
  const stateRef = useRef(state)
  stateRef.current = state

  /** Si mon tour n'est encore qu'annoncé, attendre la confirmation du serveur (quelques dizaines de ms) */
  const waitConfirmed = async () => {
    const until = Date.now() + 4000
    while (stateRef.current?.room.predicted && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 25))
    }
  }
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Présence : battement de cœur régulier (détection des déconnexions côté serveur)
  useEffect(() => {
    if (!code) return
    let inFlight = false
    let last = 0
    const beat = () => {
      // Au réveil d'un onglet en arrière-plan, les minuteurs en retard partent d'un coup : on les ignore
      if (inFlight || Date.now() - last < HEARTBEAT_MS / 2) return
      inFlight = true
      last = Date.now()
      call('heartbeat', { code })
        .catch(() => undefined)
        .finally(() => (inFlight = false))
    }
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
        await waitConfirmed()
        await call(fn, { code, ...args })
        await refresh()
        return true
      } catch (e) {
        if (optimisticCard) {
          setHiddenCards((ids) => ids.filter((id) => id !== optimisticCard))
          setSentTurn(null)
          if (stateRef.current) announce(null, stateRef.current.room.turn_number) // annule l'annonce
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

  /** Prévient instantanément le joueur suivant (le serveur confirmera juste après) */
  const announceNext = (cardId: string, action: 'play' | 'discard') => {
    const card = serverHand?.find((c) => c.id === cardId)
    if (!state || !me || !card || state.room.predicted) return
    const next = predictNextPlayer(state, me, card, action)
    if (next) announce(next, state.room.turn_number)
  }

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
    playCard: (cardId: string, targetId?: string) => {
      announceNext(cardId, 'play')
      return run('playcard', { cardId, targetId: targetId ?? null }, cardId)
    },
    discardCard: (cardId: string) => {
      announceNext(cardId, 'discard')
      return run('discardcard', { cardId }, cardId)
    },
    respondCoupFourre: (accept: boolean) => run('respondcoupfourre', { accept }),
    startGame: () => run('startgame'),
    restartGame: () => run('restartgame'),
    kickPlayer: (playerId: string) => run('kickplayer', { playerId }),
  }
}
