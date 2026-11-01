// Tests du moteur de règles : `npm test` (dans functions/)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  claimSeat,
  createRoom,
  discardCard,
  GameError,
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
} from './engine.js'

const ALICE = 'uid-alice'
const BRUNO = 'uid-bruno'
const now = 1_000_000

function setup(): Game {
  const g = createRoom('TEST01', ALICE, 'Alice', 4, now)
  joinRoom(g, BRUNO, 'Bruno', now)
  startGame(g, ALICE)
  syncPublic(g)
  return g
}

const pid = (g: Game, name: string) => g.room.players.find((p) => p.name === name)!.id
const p = (g: Game, name: string) => g.room.players.find((x) => x.name === name)!
const give = (g: Game, name: string, card: Omit<Card, 'id'>): Card => {
  const c = { id: crypto.randomUUID(), ...card }
  g.hands[pid(g, name)].push(c)
  return c
}
const throws = (fn: () => void, pattern: RegExp) => assert.throws(fn, (e) => e instanceof GameError && pattern.test(e.message))

test('arrivée, prénom unique, lancement réservé à l’hôte', () => {
  const g = createRoom('TEST01', ALICE, 'Alice', 4, now)
  joinRoom(g, BRUNO, 'Bruno', now)
  throws(() => joinRoom(g, 'uid-x', 'bruno', now), /déjà pris/)
  throws(() => startGame(g, BRUNO), /Seul l’hôte/)
  startGame(g, ALICE)
  assert.equal(g.room.status, 'playing')
  syncPublic(g)
  assert.equal(g.room.deckCount, 106 - 13)
  assert.equal(g.room.currentPlayerId, pid(g, 'Alice'))
  assert.equal(g.hands[pid(g, 'Alice')].length, 7)
  assert.deepEqual(p(g, 'Bruno').attacks, ['feu_rouge'])
  throws(() => joinRoom(g, 'uid-y', 'Zoé', now), /déjà commencé/)
})

test('hors tour, carte étrangère, intrus', () => {
  const g = setup()
  throws(() => discardCard(g, BRUNO, g.hands[pid(g, 'Bruno')][0].id, now), /pas votre tour/)
  throws(() => discardCard(g, ALICE, g.hands[pid(g, 'Bruno')][0].id, now), /pas dans votre main/)
  throws(() => discardCard(g, 'uid-intrus', 'x', now), /ne faites pas partie/)
})

test('règles de distance : feu rouge, limite, 1 000 pile, deux 200 max', () => {
  const g = setup()
  const c100 = give(g, 'Alice', { type: 'distance', value: '100' })
  throws(() => playCard(g, ALICE, c100.id, null, now), /Feu vert/)
  p(g, 'Alice').attacks = ['limite']
  throws(() => playCard(g, ALICE, c100.id, null, now), /Limite de vitesse/)
  p(g, 'Alice').attacks = []
  p(g, 'Alice').distance = 950
  throws(() => playCard(g, ALICE, c100.id, null, now), /dépasseriez/)
  p(g, 'Alice').distance = 700
  p(g, 'Alice').count200 = 2
  const c200 = give(g, 'Alice', { type: 'distance', value: '200' })
  throws(() => playCard(g, ALICE, c200.id, null, now), /deux cartes 200/)
  p(g, 'Alice').distance = 975
  const c25 = give(g, 'Alice', { type: 'distance', value: '25' })
  playCard(g, ALICE, c25.id, null, now)
  assert.equal(g.room.status, 'finished')
  assert.equal(g.room.winnerId, pid(g, 'Alice'))
})

test('attaque, parade et protection par botte', () => {
  const g = setup()
  p(g, 'Alice').attacks = []
  p(g, 'Bruno').attacks = []
  g.hands[pid(g, 'Bruno')] = g.hands[pid(g, 'Bruno')].filter((c) => c.value !== 'increvable')
  const crev = give(g, 'Alice', { type: 'attack', value: 'crevaison' })
  playCard(g, ALICE, crev.id, pid(g, 'Bruno'), now)
  assert.deepEqual(p(g, 'Bruno').attacks, ['crevaison'])
  assert.equal(g.room.currentPlayerId, pid(g, 'Bruno'))
  const roue = give(g, 'Bruno', { type: 'remedy', value: 'roue_secours' })
  playCard(g, BRUNO, roue.id, null, now)
  assert.deepEqual(p(g, 'Bruno').attacks, [])
  p(g, 'Bruno').protections = ['increvable']
  const crev2 = give(g, 'Alice', { type: 'attack', value: 'crevaison' })
  throws(() => playCard(g, ALICE, crev2.id, pid(g, 'Bruno'), now), /protégé/)
})

test('coup fourré : botte posée, pioche bonus, le joueur rejoue', () => {
  const g = setup()
  p(g, 'Alice').attacks = []
  p(g, 'Bruno').attacks = []
  give(g, 'Bruno', { type: 'safety', value: 'increvable' })
  const crev = give(g, 'Alice', { type: 'attack', value: 'crevaison' })
  playCard(g, ALICE, crev.id, pid(g, 'Bruno'), now)
  assert.equal(g.room.pendingAttack?.attack, 'crevaison')
  throws(() => discardCard(g, ALICE, g.hands[pid(g, 'Alice')][0].id, now), /réaction/)
  const before = g.hands[pid(g, 'Bruno')].length
  respondCoupFourre(g, BRUNO, true, now + 1000)
  assert.deepEqual(p(g, 'Bruno').attacks, [])
  assert.deepEqual(p(g, 'Bruno').coupFourres, ['increvable'])
  assert.equal(g.hands[pid(g, 'Bruno')].length, before - 1 + 2)
  assert.equal(g.room.currentPlayerId, pid(g, 'Bruno'))
})

test('coup fourré expiré : l’attaque reste, le tour passe', () => {
  const g = setup()
  p(g, 'Alice').attacks = []
  p(g, 'Bruno').attacks = []
  give(g, 'Bruno', { type: 'safety', value: 'increvable' })
  playCard(g, ALICE, give(g, 'Alice', { type: 'attack', value: 'crevaison' }).id, pid(g, 'Bruno'), now)
  updatePresence(g, { [ALICE]: now + 25_000, [BRUNO]: now + 25_000 }, now + 25_000)
  assert.equal(g.room.pendingAttack, null)
  assert.deepEqual(p(g, 'Bruno').attacks, ['crevaison'])
  assert.equal(g.room.currentPlayerId, pid(g, 'Bruno'))
})

test('déconnexion, retrait par l’hôte, forfait puis retour au salon', () => {
  const g = setup()
  updatePresence(g, { [ALICE]: now }, now + 40_000)
  assert.equal(p(g, 'Bruno').isConnected, false)
  throws(() => kickPlayer(g, BRUNO, pid(g, 'Alice')), /Seul l’hôte/)
  kickPlayer(g, ALICE, pid(g, 'Bruno'))
  assert.equal(g.room.status, 'finished')
  restartGame(g, ALICE)
  assert.equal(g.room.status, 'lobby')
})

test('reprise de place de l’hôte sur son téléphone', () => {
  const g = createRoom('TEST01', 'uid-ordi', 'Alice', 4, now)
  claimSeat(g, 'uid-tel')
  assert.equal(g.room.players[0].uid, 'uid-tel')
  joinRoom(g, BRUNO, 'Bruno', now)
  startGame(g, 'uid-ordi') // l'ordinateur garde les droits d'hôte
  assert.equal(g.room.status, 'playing')
})

test('partie complète automatique : se termine sans enfreindre les règles', () => {
  for (let round = 0; round < 30; round++) {
    const g = setup()
    let guard = 0
    while (g.room.status === 'playing' && guard++ < 2000) {
      const pending = g.room.pendingAttack
      if (pending) {
        const uid = g.room.players.find((x) => x.id === pending.targetId)!.uid
        respondCoupFourre(g, uid, true, now)
        continue
      }
      const cur = g.room.players.find((x) => x.id === g.room.currentPlayerId)!
      const other = g.room.players.find((x) => x.id !== cur.id)!
      const order = { safety: 0, remedy: 1, distance: 2, attack: 3 }
      const hand = [...g.hands[cur.id]].sort(
        (a, b) => order[a.type] - order[b.type] || Number(b.value) - Number(a.value) || 0,
      )
      let played = false
      for (const c of hand) {
        try {
          playCard(g, cur.uid, c.id, c.type === 'attack' ? other.id : null, now)
          played = true
          break
        } catch (e) {
          if (!(e instanceof GameError)) throw e
        }
      }
      if (!played) discardCard(g, cur.uid, g.hands[cur.id][0].id, now)
    }
    assert.equal(g.room.status, 'finished')
    for (const x of g.room.players) {
      assert.ok(x.distance <= 1000 && x.count200 <= 2)
    }
    const total = g.deck.length + g.discard.length + Object.values(g.hands).flat().length
    assert.ok(total <= 106)
  }
})
