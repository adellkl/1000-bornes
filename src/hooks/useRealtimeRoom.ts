import { onValue, ref as dbRef, set } from 'firebase/database'
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, ensureSession, rtdb } from '../lib/firebase'
import type { Card, GameEvent, GameState, Player } from '../types/game'

interface RoomDoc {
  code: string
  hostUid: string
  hostPlayerId: string
  status: GameState['room']['status']
  maxPlayers: number
  currentPlayerId: string | null
  winnerId: string | null
  pendingAttack: { targetId: string; attackerId: string; attack: string; expiresAt: number } | null
  turnNumber: number
  deckCount: number
  discardTop: Card | null
  eventSeq: number
  players: (Omit<Player, 'is_me' | 'hand_count' | 'coup_fourres' | 'count_200' | 'is_connected'> & {
    uid: string
    handCount: number
    coupFourres: Player['coup_fourres']
    count200: number
    isConnected: boolean
  })[]
}

interface Announce {
  by: string
  nextPlayerId: string | null
  turn: number
  at: number
}

const ANNOUNCE_TTL_MS = 4000

/**
 * Écoute la salle en temps réel (Firestore onSnapshot) et assemble l'état vu par ce joueur :
 * salle publique + journal + SA main (les règles Firestore interdisent de lire celle des autres).
 */
export function useRealtimeRoom(code: string | undefined) {
  const [uid, setUid] = useState<string | null>(null)
  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [events, setEvents] = useState<GameEvent[]>([])
  const [hand, setHand] = useState<Card[]>([])
  const [claimToken, setClaimToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(false)
  // Annonces instantanées du tour suivant (écrites par le joueur qui vient de jouer)
  const [announces, setAnnounces] = useState<Announce[]>([])
  const [clock, setClock] = useState(() => Date.now())

  useEffect(() => {
    // Préchauffe le serveur de jeu pendant le chargement de la page
    fetch('/api/game').catch(() => undefined)
    ensureSession()
      .then(setUid)
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  // Salle + journal
  useEffect(() => {
    if (!code || !uid) return
    setLoading(true)
    setRoom(null)
    const ref = doc(db, 'rooms', code)
    const offRoom = onSnapshot(
      ref,
      { includeMetadataChanges: true },
      (snap) => {
        setLive(!snap.metadata.fromCache)
        if (!snap.exists()) {
          setError('Salle introuvable.')
          setRoom(null)
        } else {
          setError(null)
          setRoom(snap.data() as RoomDoc)
        }
        setLoading(false)
      },
      (e) => {
        setError(e.message)
        setLoading(false)
      },
    )
    const offEvents = onSnapshot(query(collection(ref, 'events'), orderBy('seq', 'desc'), limit(20)), (snap) =>
      setEvents(
        snap.docs
          .map((d) => {
            const e = d.data()
            return {
              id: e.seq,
              player_id: e.playerId,
              action: e.action,
              payload: e.payload ?? {},
              created_at: new Date(e.createdAt).toISOString(),
            } as GameEvent
          })
          .reverse(),
      ),
    )
    const offLive = onValue(
      dbRef(rtdb, `live/${code}`),
      (snap) => {
        const val = (snap.val() ?? {}) as Record<string, Omit<Announce, 'by'>>
        setAnnounces(Object.entries(val).map(([by, a]) => ({ by, nextPlayerId: a.nextPlayerId ?? null, turn: a.turn, at: a.at })))
      },
      () => setAnnounces([]),
    )
    return () => {
      offRoom()
      offEvents()
      offLive()
    }
  }, [code, uid])

  /** Annonce le joueur suivant à tous, sans attendre la validation serveur (null = annuler) */
  const announce = useCallback(
    (nextPlayerId: string | null, turn: number) => {
      if (!code || !uid) return
      set(dbRef(rtdb, `live/${code}/${uid}`), { nextPlayerId, turn, at: Date.now() }).catch(() => undefined)
    },
    [code, uid],
  )

  const myPlayerId = room?.players.find((p) => p.uid === uid)?.id ?? null
  const isScreenOwner = Boolean(room && uid && room.hostUid === uid)

  // Ma main (document privé)
  useEffect(() => {
    if (!code || !myPlayerId) return setHand([])
    return onSnapshot(
      doc(db, 'rooms', code, 'hands', myPlayerId),
      (snap) => setHand((snap.data()?.cards as Card[]) ?? []),
      () => setHand([]),
    )
  }, [code, myPlayerId])

  // Jeton de reprise de place (ordinateur hôte uniquement)
  useEffect(() => {
    if (!code || !isScreenOwner) return setClaimToken(null)
    return onSnapshot(
      doc(db, 'rooms', code, 'secrets', 'host'),
      (snap) => setClaimToken((snap.data()?.claimToken as string) ?? null),
      () => setClaimToken(null),
    )
  }, [code, isScreenOwner])

  // Annonce valable : faite par le joueur courant, pour ce tour, récente, hors coup fourré
  const currentUid = room?.players.find((p) => p.id === room.currentPlayerId)?.uid
  const prediction = announces.find(
    (a) =>
      room &&
      a.by === currentUid &&
      a.nextPlayerId &&
      a.turn === room.turnNumber &&
      room.status === 'playing' &&
      !room.pendingAttack &&
      clock - a.at < ANNOUNCE_TTL_MS,
  )
  // Une annonce expire d'elle-même si le serveur ne confirme pas
  useEffect(() => {
    if (!prediction) return
    const id = setTimeout(() => setClock(Date.now()), Math.max(0, ANNOUNCE_TTL_MS - (Date.now() - prediction.at)) + 10)
    return () => clearTimeout(id)
  }, [prediction])
  useEffect(() => setClock(Date.now()), [announces])

  const state: GameState | null = useMemo(() => {
    if (!room || !uid) return null
    const players: Player[] = [...room.players]
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        distance: p.distance,
        hand_count: p.handCount,
        attacks: p.attacks,
        protections: p.protections,
        coup_fourres: p.coupFourres,
        count_200: p.count200,
        is_connected: p.isConnected,
        is_me: p.uid === uid,
      }))
    const pending = room.pendingAttack
    return {
      room: {
        id: room.code,
        code: room.code,
        status: room.status,
        max_players: room.maxPlayers,
        current_player_id: prediction?.nextPlayerId ?? room.currentPlayerId,
        predicted: Boolean(prediction),
        winner_id: room.winnerId,
        host_player_id: room.hostPlayerId,
        pending_attack: pending
          ? {
              target_id: pending.targetId,
              attacker_id: pending.attackerId,
              attack: pending.attack as GameState['players'][number]['attacks'][number],
              expires_at: new Date(pending.expiresAt).toISOString(),
            }
          : null,
        turn_number: room.turnNumber,
        version: room.eventSeq,
        deck_count: room.deckCount,
        discard_top: room.discardTop,
        is_host: room.hostUid === uid || room.players.some((p) => p.id === room.hostPlayerId && p.uid === uid),
        is_screen_owner: room.hostUid === uid,
        host_claim_token: claimToken,
      },
      players,
      me: myPlayerId ? { player_id: myPlayerId, hand } : null,
      events,
      server_time: new Date().toISOString(),
    }
  }, [room, uid, events, hand, claimToken, myPlayerId, prediction])

  // Firestore pousse les changements tout seul ; refresh reste disponible pour l'API des hooks.
  const refresh = useCallback(async () => undefined, [])

  return { state, error: state ? null : error, loading, live, refresh, announce }
}
