/**
 * Actions de jeu : chacune charge l'état complet de la salle dans une transaction
 * Firestore, valide le coup avec le moteur (engine.ts), puis réécrit l'état public
 * et les mains privées. Le client n'écrit jamais dans Firestore (règles : écriture interdite).
 */
import type { Transaction } from 'firebase-admin/firestore'
import { db } from './admin.js'
import {
  claimSeat,
  createRoom,
  discardCard,
  GameError,
  generateCode,
  joinRoom,
  kickPlayer,
  playCard,
  respondCoupFourre,
  restartGame,
  startGame,
  syncPublic,
  updatePresence,
  DISCONNECT_MS,
  type Card,
  type Game,
  type RoomPub,
} from './engine.js'

type Data = Record<string, unknown>

const roomRef = (code: string) => db.collection('rooms').doc(code)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

function normCode(raw: unknown): string {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new GameError('Code de salle invalide.')
  return code
}

async function load(tx: Transaction, code: string): Promise<Game> {
  const ref = roomRef(code)
  const [roomSnap, privSnap, handsSnap] = await Promise.all([
    tx.get(ref),
    tx.get(ref.collection('private').doc('state')),
    tx.get(ref.collection('hands')),
  ])
  if (!roomSnap.exists) throw new GameError('Salle introuvable.')
  const priv = privSnap.data() ?? {}
  const hands: Record<string, Card[]> = {}
  handsSnap.forEach((d) => (hands[d.id] = (d.data().cards as Card[]) ?? []))
  return {
    room: roomSnap.data() as RoomPub,
    deck: (priv.deck as Card[]) ?? [],
    discard: (priv.discard as Card[]) ?? [],
    hands,
    events: [],
  }
}

function save(tx: Transaction, code: string, g: Game, previousHandIds: string[] = []) {
  syncPublic(g)
  const ref = roomRef(code)
  const now = Date.now()
  for (const e of g.events) {
    g.room.eventSeq += 1
    tx.set(ref.collection('events').doc(String(g.room.eventSeq).padStart(8, '0')), {
      seq: g.room.eventSeq,
      playerId: e.playerId,
      action: e.action,
      payload: e.payload,
      createdAt: now,
    })
  }
  tx.set(ref, { ...g.room, updatedAt: now })
  tx.set(ref.collection('private').doc('state'), { deck: g.deck, discard: g.discard })
  for (const p of g.room.players) {
    tx.set(ref.collection('hands').doc(p.id), { uid: p.uid, cards: g.hands[p.id] ?? [] })
  }
  for (const id of previousHandIds) {
    if (!g.room.players.some((p) => p.id === id)) tx.delete(ref.collection('hands').doc(id))
  }
}

/** Action transactionnelle standard sur une salle existante */
function gameAction<T>(fn: (g: Game, uid: string, data: Data, now: number) => T) {
  return (uid: string, data: Data) => {
    const code = normCode(data.code)
    return db.runTransaction(async (tx) => {
      const g = await load(tx, code)
      const before = Object.keys(g.hands)
      const result = fn(g, uid, data, Date.now())
      save(tx, code, g, before)
      return result ?? null
    })
  }
}

export const ACTIONS: Record<string, (uid: string, data: Data) => Promise<unknown>> = {
  createroom: (uid, data) =>
    db.runTransaction(async (tx) => {
      let code = generateCode()
      for (let i = 0; i < 5 && (await tx.get(roomRef(code))).exists; i++) code = generateCode()
      const g = createRoom(code, uid, data.name, data.maxPlayers, Date.now())
      tx.set(roomRef(code).collection('secrets').doc('host'), { hostUid: uid, claimToken: crypto.randomUUID() })
      save(tx, code, g)
      return code
    }),

  joinroom: gameAction((g, uid, d, now) => joinRoom(g, uid, d.name, now)),
  startgame: gameAction((g, uid) => startGame(g, uid)),
  restartgame: gameAction((g, uid) => restartGame(g, uid)),
  playcard: gameAction((g, uid, d, now) => playCard(g, uid, str(d.cardId), str(d.targetId) || null, now)),
  discardcard: gameAction((g, uid, d, now) => discardCard(g, uid, str(d.cardId), now)),
  respondcoupfourre: gameAction((g, uid, d, now) => respondCoupFourre(g, uid, d.accept === true, now)),
  kickplayer: gameAction((g, uid, d) => kickPlayer(g, uid, str(d.playerId))),

  claimseat: (uid, data) => {
    const code = normCode(data.code)
    return db.runTransaction(async (tx) => {
      const secret = await tx.get(roomRef(code).collection('secrets').doc('host'))
      const g = await load(tx, code)
      if (!secret.exists || secret.get('claimToken') !== data.token) throw new GameError('Lien de reprise invalide.')
      const id = claimSeat(g, uid)
      save(tx, code, g)
      return id
    })
  },

  /** Présence (~ toutes les 10 s) + entretien : déconnexions, expiration des coups fourrés. */
  heartbeat: async (uid, data) => {
    const code = normCode(data.code)
    const presence = roomRef(code).collection('presence')
    const [, roomSnap, seen] = await Promise.all([
      presence.doc(uid).set({ lastSeen: Date.now() }),
      roomRef(code).get(),
      presence.get(),
    ])
    // Lecture simple d'abord : on ne verrouille la salle (transaction) que si
    // quelque chose doit vraiment changer, pour ne jamais ralentir les coups des joueurs.
    const room = roomSnap.data() as RoomPub | undefined
    if (!room) throw new GameError('Salle introuvable.')
    const now = Date.now()
    const lastSeenMap: Record<string, number> = { [uid]: now }
    seen.forEach((d) => (lastSeenMap[d.id] ??= d.get('lastSeen') as number))
    const needsUpdate =
      room.players.some((p) => p.isConnected !== now - (lastSeenMap[p.uid] ?? 0) < DISCONNECT_MS) ||
      (room.status === 'playing' && room.pendingAttack !== null && room.pendingAttack.expiresAt <= now)
    if (!needsUpdate) return null

    return db.runTransaction(async (tx) => {
      const [g, seenSnap] = await Promise.all([load(tx, code), tx.get(presence)])
      const lastSeen: Record<string, number> = {}
      seenSnap.forEach((d) => (lastSeen[d.id] = d.get('lastSeen') as number))
      if (updatePresence(g, lastSeen, Date.now())) save(tx, code, g)
      return null
    })
  },
}

export { GameError }
