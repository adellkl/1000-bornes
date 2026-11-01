/**
 * Moteur de règles de Route 1000 — exécuté UNIQUEMENT côté serveur (Cloud Functions).
 * Fonctions pures : elles reçoivent l'état complet d'une salle, le modifient et
 * renvoient les événements à journaliser. Toute erreur de règle lève une GameError.
 */

export type CardType = 'distance' | 'attack' | 'remedy' | 'safety'
export interface Card {
  id: string
  type: CardType
  value: string
}

export interface PendingAttack {
  targetId: string
  attackerId: string
  attack: string
  expiresAt: number
}

export interface PlayerPub {
  id: string
  uid: string
  name: string
  position: number
  distance: number
  handCount: number
  attacks: string[]
  protections: string[]
  coupFourres: string[]
  count200: number
  isConnected: boolean
}

export type RoomStatus = 'lobby' | 'playing' | 'finished'

export interface RoomPub {
  code: string
  hostUid: string
  hostPlayerId: string
  status: RoomStatus
  maxPlayers: number
  currentPlayerId: string | null
  winnerId: string | null
  pendingAttack: PendingAttack | null
  turnNumber: number
  deckCount: number
  discardTop: Card | null
  players: PlayerPub[]
  eventSeq: number
  createdAt: number
}

export interface GameEvent {
  playerId: string | null
  action: string
  payload: Record<string, unknown>
}

/** État complet d'une salle (public + secret) chargé dans une transaction */
export interface Game {
  room: RoomPub
  deck: Card[]
  discard: Card[]
  hands: Record<string, Card[]>
  events: GameEvent[]
}

export class GameError extends Error {}

export const GOAL = 1000
export const COUP_FOURRE_MS = 20_000
export const DISCONNECT_MS = 30_000

const COMPOSITION: [CardType, string, number][] = [
  ['distance', '25', 10], ['distance', '50', 10], ['distance', '75', 10],
  ['distance', '100', 12], ['distance', '200', 4],
  ['attack', 'feu_rouge', 5], ['attack', 'limite', 4], ['attack', 'panne', 3],
  ['attack', 'crevaison', 3], ['attack', 'accident', 3],
  ['remedy', 'feu_vert', 14], ['remedy', 'fin_limite', 6], ['remedy', 'essence', 6],
  ['remedy', 'roue_secours', 6], ['remedy', 'reparations', 6],
  ['safety', 'vehicule_prioritaire', 1], ['safety', 'citerne', 1],
  ['safety', 'increvable', 1], ['safety', 'as_du_volant', 1],
]

export const HAZARDS = ['feu_rouge', 'panne', 'crevaison', 'accident']

const SAFETY_FOR: Record<string, string> = {
  feu_rouge: 'vehicule_prioritaire',
  limite: 'vehicule_prioritaire',
  panne: 'citerne',
  crevaison: 'increvable',
  accident: 'as_du_volant',
}
const ATTACK_FOR_REMEDY: Record<string, string> = {
  feu_vert: 'feu_rouge',
  fin_limite: 'limite',
  essence: 'panne',
  roue_secours: 'crevaison',
  reparations: 'accident',
}
const COVERED_BY: Record<string, string[]> = {
  vehicule_prioritaire: ['feu_rouge', 'limite'],
  citerne: ['panne'],
  increvable: ['crevaison'],
  as_du_volant: ['accident'],
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)]
  return code
}

export function newId(): string {
  return crypto.randomUUID()
}

export function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (name.length < 1 || name.length > 20) throw new GameError('Le prénom doit faire entre 1 et 20 caractères.')
  return name
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildDeck(): Card[] {
  const cards: Card[] = []
  for (const [type, value, qty] of COMPOSITION) {
    for (let i = 0; i < qty; i++) cards.push({ id: newId(), type, value })
  }
  return shuffle(cards)
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

const player = (g: Game, id: string | null | undefined): PlayerPub => {
  const p = g.room.players.find((x) => x.id === id)
  if (!p) throw new GameError('Joueur introuvable.')
  return p
}

export function playerByUid(g: Game, uid: string): PlayerPub | undefined {
  return g.room.players.find((p) => p.uid === uid)
}

function requireMe(g: Game, uid: string): PlayerPub {
  const me = playerByUid(g, uid)
  if (!me) throw new GameError('Vous ne faites pas partie de cette partie.')
  return me
}

export function isHost(g: Game, uid: string): boolean {
  return g.room.hostUid === uid || g.room.players.some((p) => p.id === g.room.hostPlayerId && p.uid === uid)
}

function log(g: Game, playerId: string | null, action: string, payload: Record<string, unknown> = {}) {
  g.events.push({ playerId, action, payload })
}

function sorted(g: Game) {
  return [...g.room.players].sort((a, b) => a.position - b.position)
}

export function nextPlayer(g: Game, afterId: string): string {
  const list = sorted(g)
  const pos = g.room.players.find((p) => p.id === afterId)?.position ?? -1
  return (list.find((p) => p.position > pos) ?? list[0]).id
}

function draw(g: Game, playerId: string): Card | null {
  const card = g.deck.shift() ?? null
  if (card) (g.hands[playerId] ??= []).push(card)
  return card
}

function takeFromHand(g: Game, playerId: string, cardId: string): Card {
  const hand = g.hands[playerId] ?? []
  const idx = hand.findIndex((c) => c.id === cardId)
  if (idx < 0) throw new GameError('Cette carte n’est pas dans votre main.')
  return hand.splice(idx, 1)[0]
}

function finish(g: Game, winnerId: string | null, reason: string) {
  g.room.status = 'finished'
  g.room.winnerId = winnerId
  g.room.currentPlayerId = null
  g.room.pendingAttack = null
  log(g, winnerId, 'finish', {
    reason,
    winner_name: g.room.players.find((p) => p.id === winnerId)?.name,
  })
}

function finishByDistance(g: Game) {
  const best = [...g.room.players].sort((a, b) => b.distance - a.distance || a.position - b.position)[0]
  finish(g, best?.id ?? null, 'deck_empty')
}

/** Début de tour : pioche automatique ; saute les joueurs sans carte quand la pioche est vide. */
function beginTurn(g: Game, playerId: string) {
  let id = playerId
  for (let tries = 0; ; tries++) {
    if (g.deck.length > 0 || (g.hands[id]?.length ?? 0) > 0) break
    if (tries >= g.room.players.length) return finishByDistance(g)
    id = nextPlayer(g, id)
  }
  g.room.currentPlayerId = id
  g.room.turnNumber += 1
  draw(g, id)
}

/** Recalcule les champs publics dérivés (nombre de cartes, pioche, défausse). */
export function syncPublic(g: Game) {
  for (const p of g.room.players) p.handCount = g.hands[p.id]?.length ?? 0
  g.room.deckCount = g.deck.length
  g.room.discardTop = g.discard[g.discard.length - 1] ?? null
}

function requirePlaying(g: Game, uid: string, now: number): PlayerPub {
  resolveExpired(g, now)
  if (g.room.status !== 'playing') throw new GameError('La partie n’est pas en cours.')
  const me = requireMe(g, uid)
  if (g.room.pendingAttack) throw new GameError('En attente de la réaction d’un joueur attaqué.')
  if (g.room.currentPlayerId !== me.id) throw new GameError('Ce n’est pas votre tour.')
  return me
}

// ---------------------------------------------------------------------------
//  Actions
// ---------------------------------------------------------------------------

export function createRoom(code: string, uid: string, rawName: unknown, maxPlayers: unknown, now: number): Game {
  const name = cleanName(rawName)
  const max = Number(maxPlayers)
  if (!Number.isInteger(max) || max < 2 || max > 6) throw new GameError('Le nombre de joueurs doit être compris entre 2 et 6.')
  const hostPlayer = newPlayer(uid, name, 0, now)
  const g: Game = {
    room: {
      code,
      hostUid: uid,
      hostPlayerId: hostPlayer.id,
      status: 'lobby',
      maxPlayers: max,
      currentPlayerId: null,
      winnerId: null,
      pendingAttack: null,
      turnNumber: 0,
      deckCount: 0,
      discardTop: null,
      players: [hostPlayer],
      eventSeq: 0,
      createdAt: now,
    },
    deck: [],
    discard: [],
    hands: { [hostPlayer.id]: [] },
    events: [],
  }
  log(g, hostPlayer.id, 'join', { name })
  return g
}

function newPlayer(uid: string, name: string, position: number, _now: number): PlayerPub {
  return {
    id: newId(),
    uid,
    name,
    position,
    distance: 0,
    handCount: 0,
    attacks: [],
    protections: [],
    coupFourres: [],
    count200: 0,
    isConnected: true,
  }
}

export function joinRoom(g: Game, uid: string, rawName: unknown, now: number): string {
  const name = cleanName(rawName)
  const existing = playerByUid(g, uid)
  if (existing) {
    existing.name = name
    existing.isConnected = true
    return existing.id
  }
  if (g.room.status !== 'lobby') throw new GameError('La partie a déjà commencé.')
  if (g.room.players.length >= g.room.maxPlayers) throw new GameError('La salle est complète.')
  if (g.room.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
    throw new GameError('Ce prénom est déjà pris dans cette salle.')
  const position = Math.max(-1, ...g.room.players.map((p) => p.position)) + 1
  const p = newPlayer(uid, name, position, now)
  g.room.players.push(p)
  g.hands[p.id] = []
  log(g, p.id, 'join', { name })
  return p.id
}

/** L'hôte transfère sa place de joueur vers son téléphone. */
export function claimSeat(g: Game, uid: string): string {
  if (g.room.players.some((p) => p.uid === uid && p.id !== g.room.hostPlayerId))
    throw new GameError('Cet appareil occupe déjà une autre place dans la partie.')
  const seat = player(g, g.room.hostPlayerId)
  seat.uid = uid
  seat.isConnected = true
  return seat.id
}

function deal(g: Game) {
  g.deck = buildDeck()
  g.discard = []
  for (const p of g.room.players) {
    p.distance = 0
    p.attacks = ['feu_rouge'] // départ à l'arrêt : un Feu vert est nécessaire
    p.protections = []
    p.coupFourres = []
    p.count200 = 0
    g.hands[p.id] = []
  }
  for (const p of sorted(g)) for (let i = 0; i < 6; i++) draw(g, p.id)
}

export function startGame(g: Game, uid: string) {
  if (!isHost(g, uid)) throw new GameError('Seul l’hôte peut lancer la partie.')
  if (g.room.status !== 'lobby') throw new GameError('La partie est déjà lancée.')
  if (g.room.players.length < 2) throw new GameError('Il faut au moins 2 joueurs pour lancer la partie.')
  deal(g)
  Object.assign(g.room, { status: 'playing', winnerId: null, pendingAttack: null, turnNumber: 0 })
  log(g, null, 'start')
  beginTurn(g, sorted(g)[0].id)
}

export function restartGame(g: Game, uid: string) {
  if (!isHost(g, uid)) throw new GameError('Seul l’hôte peut relancer la partie.')
  if (g.room.status === 'lobby') throw new GameError('La partie n’a pas encore commencé.')
  // Moins de 2 joueurs (retraits) : retour au salon pour accueillir de nouveaux pilotes
  if (g.room.players.length < 2) {
    g.deck = []
    g.discard = []
    for (const p of g.room.players) {
      Object.assign(p, { distance: 0, attacks: [], protections: [], coupFourres: [], count200: 0 })
      g.hands[p.id] = []
    }
    Object.assign(g.room, { status: 'lobby', winnerId: null, pendingAttack: null, currentPlayerId: null })
    log(g, null, 'restart')
    return
  }
  const previousWinner = g.room.winnerId ?? g.room.hostPlayerId
  deal(g)
  Object.assign(g.room, { status: 'playing', winnerId: null, pendingAttack: null, turnNumber: 0 })
  log(g, null, 'restart')
  beginTurn(g, nextPlayer(g, previousWinner))
}

export function playCard(g: Game, uid: string, cardId: string, targetId: string | null, now: number) {
  const me = requirePlaying(g, uid, now)
  const card = (g.hands[me.id] ?? []).find((c) => c.id === cardId)
  if (!card) throw new GameError('Cette carte n’est pas dans votre main.')
  const base = { card_type: card.type, card_value: card.value, player_name: me.name }

  switch (card.type) {
    case 'distance': {
      const value = Number(card.value)
      if (me.attacks.includes('feu_rouge')) throw new GameError('Feu rouge : il vous faut un Feu vert pour rouler.')
      if (me.attacks.some((a) => HAZARDS.includes(a))) throw new GameError('Vous êtes immobilisé : posez d’abord la parade.')
      if (me.attacks.includes('limite') && value > 50)
        throw new GameError('Limite de vitesse : seules les cartes 25 et 50 sont autorisées.')
      if (me.distance + value > GOAL) throw new GameError('Impossible : vous dépasseriez 1 000 bornes.')
      if (value === 200 && me.count200 >= 2) throw new GameError('Maximum deux cartes 200 bornes par joueur.')
      takeFromHand(g, me.id, card.id)
      me.distance += value
      if (value === 200) me.count200 += 1
      log(g, me.id, 'play_distance', { ...base, distance: me.distance })
      if (me.distance === GOAL) return finish(g, me.id, 'exact_1000')
      return beginTurn(g, nextPlayer(g, me.id))
    }

    case 'remedy': {
      const attack = ATTACK_FOR_REMEDY[card.value]
      if (!me.attacks.includes(attack)) throw new GameError('Aucune attaque à réparer avec cette carte.')
      takeFromHand(g, me.id, card.id)
      me.attacks = me.attacks.filter((a) => a !== attack)
      log(g, me.id, 'play_remedy', base)
      return beginTurn(g, nextPlayer(g, me.id))
    }

    case 'attack': {
      if (!targetId) throw new GameError('Choisissez un adversaire à attaquer.')
      const target = g.room.players.find((p) => p.id === targetId)
      if (!target) throw new GameError('Adversaire introuvable.')
      if (target.id === me.id) throw new GameError('Vous ne pouvez pas vous attaquer vous-même.')
      const safety = SAFETY_FOR[card.value]
      if (target.protections.includes(safety)) throw new GameError(`${target.name} est protégé contre cette attaque.`)
      if (card.value === 'limite') {
        if (target.attacks.includes('limite')) throw new GameError(`${target.name} est déjà sous limitation de vitesse.`)
      } else if (target.attacks.some((a) => HAZARDS.includes(a))) {
        throw new GameError(`${target.name} est déjà immobilisé.`)
      }
      takeFromHand(g, me.id, card.id)
      target.attacks = [...target.attacks, card.value]
      log(g, me.id, 'play_attack', { ...base, target_id: target.id, target_name: target.name })
      // Coup fourré possible : fenêtre de réaction pour la cible
      if ((g.hands[target.id] ?? []).some((c) => c.value === safety)) {
        g.room.pendingAttack = { targetId: target.id, attackerId: me.id, attack: card.value, expiresAt: now + COUP_FOURRE_MS }
        return
      }
      return beginTurn(g, nextPlayer(g, me.id))
    }

    case 'safety': {
      takeFromHand(g, me.id, card.id)
      const covered = COVERED_BY[card.value] ?? []
      me.protections = [...me.protections, card.value]
      me.attacks = me.attacks.filter((a) => !covered.includes(a))
      log(g, me.id, 'play_safety', base)
      return beginTurn(g, me.id) // une botte donne le droit de rejouer
    }
  }
}

export function discardCard(g: Game, uid: string, cardId: string, now: number) {
  const me = requirePlaying(g, uid, now)
  const card = takeFromHand(g, me.id, cardId)
  g.discard.push(card)
  log(g, me.id, 'discard', { card_type: card.type, card_value: card.value, player_name: me.name })
  beginTurn(g, nextPlayer(g, me.id))
}

export function respondCoupFourre(g: Game, uid: string, accept: boolean, now: number) {
  const me = requireMe(g, uid)
  const pending = g.room.pendingAttack
  if (!pending || pending.targetId !== me.id) throw new GameError('Aucune attaque en attente de votre réaction.')
  if (pending.expiresAt < now) {
    resolveExpired(g, now)
    throw new GameError('Trop tard : le délai du coup fourré est écoulé.')
  }
  g.room.pendingAttack = null
  if (!accept) return beginTurn(g, nextPlayer(g, pending.attackerId))

  const safety = SAFETY_FOR[pending.attack]
  const card = (g.hands[me.id] ?? []).find((c) => c.value === safety)
  if (!card) throw new GameError('Vous n’avez pas la botte correspondante.')
  takeFromHand(g, me.id, card.id)
  const covered = COVERED_BY[safety]
  me.protections = [...me.protections, safety]
  me.coupFourres = [...me.coupFourres, safety]
  me.attacks = me.attacks.filter((a) => !covered.includes(a))
  log(g, me.id, 'coup_fourre', { card_type: 'safety', card_value: safety, attack: pending.attack, player_name: me.name })
  draw(g, me.id) // pioche supplémentaire
  beginTurn(g, me.id) // puis le joueur rejoue
}

/** Fenêtre de coup fourré expirée : l'attaque s'applique, le tour passe. */
export function resolveExpired(g: Game, now: number): boolean {
  const pending = g.room.pendingAttack
  if (!pending || pending.expiresAt > now) return false
  g.room.pendingAttack = null
  beginTurn(g, nextPlayer(g, pending.attackerId))
  return true
}

/** Met à jour la connexion des joueurs à partir des derniers battements de cœur. */
export function updatePresence(g: Game, lastSeen: Record<string, number>, now: number): boolean {
  let changed = false
  for (const p of g.room.players) {
    const seen = lastSeen[p.uid] ?? 0
    const connected = now - seen < DISCONNECT_MS
    if (p.isConnected !== connected) {
      p.isConnected = connected
      changed = true
    }
  }
  if (g.room.status === 'playing' && resolveExpired(g, now)) changed = true
  return changed
}

export function kickPlayer(g: Game, uid: string, playerId: string) {
  if (!isHost(g, uid)) throw new GameError('Seul l’hôte peut retirer un joueur.')
  const target = player(g, playerId)
  if (target.id === g.room.hostPlayerId) throw new GameError('L’hôte ne peut pas se retirer lui-même.')

  const next = nextPlayer(g, target.id)
  g.discard.push(...(g.hands[target.id] ?? []))
  delete g.hands[target.id]
  g.room.players = g.room.players.filter((p) => p.id !== target.id)
  log(g, null, 'kick', { name: target.name })

  if (g.room.status !== 'playing') return
  const pending = g.room.pendingAttack
  if (g.room.players.length < 2) return finish(g, g.room.players[0]?.id ?? null, 'forfeit')
  if (pending && (pending.targetId === target.id || pending.attackerId === target.id)) {
    g.room.pendingAttack = null
    return beginTurn(g, next)
  }
  if (g.room.currentPlayerId === target.id) beginTurn(g, next)
}
