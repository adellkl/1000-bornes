import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ensureSession, rpc, supabase } from '../lib/supabase'
import type { GameState } from '../types/game'

/**
 * Charge l'état filtré de la salle (get_game_state) et le maintient à jour :
 *  - Supabase Realtime : chaque action serveur incrémente rooms.version → UPDATE reçu → rechargement ;
 *  - repli par interrogation périodique si le canal temps réel est indisponible.
 */
export function useRealtimeRoom(code: string | undefined) {
  const [state, setState] = useState<GameState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  const requestSeq = useRef(0)
  const roomId = state?.room.id

  const refresh = useCallback(async () => {
    if (!code) return
    const seq = ++requestSeq.current
    try {
      const next = await rpc<GameState>('get_game_state', { p_code: code })
      if (seq !== requestSeq.current) return // réponse obsolète
      setState(next)
      setError(null)
    } catch (e) {
      if (seq === requestSeq.current) setError((e as Error).message)
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [code])

  // Chargement initial
  useEffect(() => {
    setLoading(true)
    setState(null)
    ensureSession()
      .then(refresh)
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [refresh])

  // Abonnement Realtime (une fois l'id de salle connu)
  useEffect(() => {
    if (!roomId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const scheduleRefresh = () => {
      clearTimeout(timer)
      timer = setTimeout(refresh, 60)
    }
    const channel: RealtimeChannel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, scheduleRefresh)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_events', filter: `room_id=eq.${roomId}` }, scheduleRefresh)
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED')
        if (status === 'SUBSCRIBED') scheduleRefresh()
      })
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [roomId, refresh])

  // Filet de sécurité : interrogation régulière (plus fréquente si le temps réel est coupé)
  useEffect(() => {
    if (!code) return
    const id = setInterval(refresh, live ? 15000 : 3000)
    const onWake = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onWake)
    }
  }, [code, live, refresh])

  return { state, error, loading, live, refresh }
}
