/**
 * Cloud Functions de Route 1000 : chaque action de jeu est une fonction « callable ».
 * Le client n'écrit jamais dans Firestore (règles : écriture interdite) ; ces fonctions
 * chargent l'état complet de la salle dans une transaction, valident le coup avec le
 * moteur (engine.ts), puis réécrivent l'état public et les mains privées.
 */
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, type Transaction } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
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
  type Card,
  type Game,
  type RoomPub,
} from './engine.js'

initializeApp()
const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true })

const OPTIONS = { region: 'europe-west1', cors: true, maxInstances: 10 }

const roomRef = (code: string) => db.collection('rooms').doc(code)

function normCode(raw: unknown): string {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : ''
  if (!/^[A-Z0-9]{4,8}$/.test(code)) throw new HttpsError('invalid-argument', 'Code de salle invalide.')
  return code
}

function requireUid(req: CallableRequest): string {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Session expirée : rechargez la page.')
  return req.auth.uid
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

function toHttpsError(e: unknown): never {
  if (e instanceof GameError) throw new HttpsError('failed-precondition', e.message)
  if (e instanceof HttpsError) throw e
  console.error(e)
  throw new HttpsError('internal', 'Erreur du serveur de jeu, réessayez.')
}

type Action<T> = (g: Game, uid: string, data: Record<string, unknown>, now: number) => T

/** Fabrique une fonction callable transactionnelle pour une action de jeu */
function gameAction<T>(fn: Action<T>) {
  return onCall(OPTIONS, async (req) => {
    const uid = requireUid(req)
    const data = (req.data ?? {}) as Record<string, unknown>
    const code = normCode(data.code)
    try {
      return await db.runTransaction(async (tx) => {
        const g = await load(tx, code)
        const before = Object.keys(g.hands)
        const result = fn(g, uid, data, Date.now())
        save(tx, code, g, before)
        return result ?? null
      })
    } catch (e) {
      toHttpsError(e)
    }
  })
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

export const createroom = onCall(OPTIONS, async (req) => {
  const uid = requireUid(req)
  const data = (req.data ?? {}) as Record<string, unknown>
  try {
    return await db.runTransaction(async (tx) => {
      let code = generateCode()
      for (let i = 0; i < 5 && (await tx.get(roomRef(code))).exists; i++) code = generateCode()
      const g = createRoom(code, uid, data.name, data.maxPlayers, Date.now())
      tx.set(roomRef(code).collection('secrets').doc('host'), { hostUid: uid, claimToken: crypto.randomUUID() })
      save(tx, code, g)
      return code
    })
  } catch (e) {
    toHttpsError(e)
  }
})

export const joinroom = gameAction((g, uid, d, now) => joinRoom(g, uid, d.name, now))
export const startgame = gameAction((g, uid) => startGame(g, uid))
export const restartgame = gameAction((g, uid) => restartGame(g, uid))
export const playcard = gameAction((g, uid, d, now) => playCard(g, uid, str(d.cardId), str(d.targetId) || null, now))
export const discardcard = gameAction((g, uid, d, now) => discardCard(g, uid, str(d.cardId), now))
export const respondcoupfourre = gameAction((g, uid, d, now) => respondCoupFourre(g, uid, d.accept === true, now))
export const kickplayer = gameAction((g, uid, d) => kickPlayer(g, uid, str(d.playerId)))

export const claimseat = onCall(OPTIONS, async (req) => {
  const uid = requireUid(req)
  const data = (req.data ?? {}) as Record<string, unknown>
  const code = normCode(data.code)
  try {
    return await db.runTransaction(async (tx) => {
      const secret = await tx.get(roomRef(code).collection('secrets').doc('host'))
      const g = await load(tx, code)
      if (!secret.exists || secret.get('claimToken') !== data.token) throw new GameError('Lien de reprise invalide.')
      const id = claimSeat(g, uid)
      save(tx, code, g)
      return id
    })
  } catch (e) {
    toHttpsError(e)
  }
})

/** Présence (~ toutes les 10 s) + entretien : déconnexions, expiration des coups fourrés. */
export const heartbeat = onCall(OPTIONS, async (req) => {
  const uid = requireUid(req)
  const code = normCode((req.data as Record<string, unknown> | undefined)?.code)
  const presence = roomRef(code).collection('presence')
  await presence.doc(uid).set({ lastSeen: Date.now() })
  try {
    return await db.runTransaction(async (tx) => {
      const [g, seenSnap] = await Promise.all([load(tx, code), tx.get(presence)])
      const lastSeen: Record<string, number> = {}
      seenSnap.forEach((d) => (lastSeen[d.id] = d.get('lastSeen') as number))
      if (updatePresence(g, lastSeen, Date.now())) save(tx, code, g)
      return null
    })
  } catch (e) {
    toHttpsError(e)
  }
})
