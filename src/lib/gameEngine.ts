/**
 * Moteur de règles côté client.
 *
 * ⚠️ Ces fonctions servent UNIQUEMENT à guider l'interface (cartes grisées,
 * choix de cible, messages). L'arbitre est le serveur : chaque coup est
 * revalidé par les fonctions RPC PostgreSQL (`play_card`, `discard_card`…).
 */
import type { AttackValue, Card, GameEvent, GameState, PlayOption, Player, RemedyValue, SafetyValue } from '../types/game'
import { ATTACK_FOR_REMEDY, CARD_INFO, COVERED_BY, GOAL, HAZARDS, SAFETY_FOR } from './deck'

export function isStopped(player: Player): boolean {
  return player.attacks.some((a) => HAZARDS.includes(a))
}

export function isLimited(player: Player): boolean {
  return player.attacks.includes('limite')
}

export function canBeAttacked(target: Player, attack: AttackValue): { ok: boolean; reason?: string } {
  if (target.protections.includes(SAFETY_FOR[attack])) {
    return { ok: false, reason: `${target.name} est protégé` }
  }
  if (attack === 'limite') {
    return target.attacks.includes('limite') ? { ok: false, reason: 'Déjà limité' } : { ok: true }
  }
  return isStopped(target) ? { ok: false, reason: 'Déjà immobilisé' } : { ok: true }
}

export function getPlayOption(card: Card, me: Player, players: Player[]): PlayOption {
  switch (card.type) {
    case 'distance': {
      const value = Number(card.value)
      if (me.attacks.includes('feu_rouge')) return { playable: false, reason: 'Il vous faut un Feu vert' }
      if (isStopped(me)) return { playable: false, reason: 'Réparez d’abord votre véhicule' }
      if (isLimited(me) && value > 50) return { playable: false, reason: 'Limite de vitesse : 25 ou 50' }
      if (me.distance + value > GOAL) return { playable: false, reason: 'Vous dépasseriez 1 000' }
      if (value === 200 && me.count_200 >= 2) return { playable: false, reason: 'Déjà deux 200 joués' }
      return { playable: true }
    }
    case 'remedy': {
      const attack = ATTACK_FOR_REMEDY[card.value as RemedyValue]
      return me.attacks.includes(attack)
        ? { playable: true }
        : { playable: false, reason: `Aucun ${CARD_INFO[attack].label.toLowerCase()} à réparer` }
    }
    case 'attack': {
      const targets = players.filter((p) => p.id !== me.id && canBeAttacked(p, card.value as AttackValue).ok)
      return targets.length > 0
        ? { playable: true, targets }
        : { playable: false, reason: 'Aucun adversaire ciblable', targets: [] }
    }
    case 'safety':
      return { playable: true }
  }
}

/** Statut lisible d'un joueur, pour les cartes de profil */
export function statusLabel(player: Player): { label: string; tone: 'go' | 'slow' | 'stop' } {
  const hazard = player.attacks.find((a) => HAZARDS.includes(a))
  if (hazard === 'feu_rouge') return { label: 'À l’arrêt', tone: 'stop' }
  if (hazard) return { label: CARD_INFO[hazard].label, tone: 'stop' }
  if (isLimited(player)) return { label: 'Limité à 50', tone: 'slow' }
  return { label: 'En route', tone: 'go' }
}

export function isCovered(player: Player, attack: AttackValue): boolean {
  return player.protections.some((s) => COVERED_BY[s as SafetyValue].includes(attack))
}

/** Classement final : distance décroissante, gagnant en tête */
export function ranking(state: GameState): Player[] {
  return [...state.players].sort((a, b) => {
    if (a.id === state.room.winner_id) return -1
    if (b.id === state.room.winner_id) return 1
    return b.distance - a.distance || a.position - b.position
  })
}

export function describeEvent(event: GameEvent): string {
  const p = event.payload
  const who = p.player_name ?? 'Un joueur'
  const card = p.card_value ? CARD_INFO[p.card_value].label : ''
  switch (event.action) {
    case 'join':
      return `${p.name} rejoint la partie`
    case 'start':
      return 'La course est lancée !'
    case 'restart':
      return 'Nouvelle manche !'
    case 'play_distance':
      return `${who} avance de ${p.card_value} bornes`
    case 'play_remedy':
      return `${who} joue ${card}`
    case 'play_attack':
      return `${who} attaque ${p.target_name} : ${card}`
    case 'play_safety':
      return `${who} pose la botte ${card}`
    case 'coup_fourre':
      return `COUP FOURRÉ de ${who} avec ${card} !`
    case 'discard':
      return `${who} défausse ${card}`
    case 'finish':
      if (p.reason === 'exact_1000') return `${p.winner_name} atteint 1 000 bornes !`
      if (p.reason === 'forfeit') return `${p.winner_name} remporte la partie par forfait`
      return `Pioche épuisée : ${p.winner_name} est le plus avancé`
    case 'kick':
      return `${p.name} a été retiré de la partie`
  }
}

export const progress = (distance: number) => Math.min(100, (distance / GOAL) * 100)

/**
 * Joueur suivant prévisible côté client, pour l'annoncer avant la confirmation serveur.
 * Renvoie null quand le serveur seul peut trancher (botte qui fait rejouer, victoire,
 * pioche vide, coup invalide).
 */
export function predictNextPlayer(state: GameState, me: Player, card: Card, action: 'play' | 'discard'): string | null {
  if (state.room.deck_count === 0 || state.room.pending_attack) return null
  if (action === 'play') {
    if (card.type === 'safety') return null
    if (card.type === 'distance' && me.distance + Number(card.value) === GOAL) return null
    if (card.type !== 'attack' && !getPlayOption(card, me, state.players).playable) return null
  }
  const sorted = [...state.players].sort((a, b) => a.position - b.position)
  const i = sorted.findIndex((p) => p.id === me.id)
  return sorted.length > 1 && i >= 0 ? sorted[(i + 1) % sorted.length].id : null
}
