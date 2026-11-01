import {
  Award,
  CircleOff,
  Container,
  Disc3,
  Fuel,
  Gauge,
  CarFront,
  CircleGauge,
  Navigation,
  LifeBuoy,
  Milestone,
  OctagonX,
  ShieldCheck,
  Siren,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { AttackValue, CardType, CardValue, RemedyValue, SafetyValue } from '../types/game'

export interface CardInfo {
  label: string
  short: string
  description: string
  icon: LucideIcon
}

/** Catalogue des cartes de Route 1000 (visuels originaux, icônes Lucide). */
export const CARD_INFO: Record<CardValue, CardInfo> = {
  '25': { label: '25 bornes', short: '25', description: 'Petite étape.', icon: Milestone },
  '50': { label: '50 bornes', short: '50', description: 'Allure tranquille.', icon: Milestone },
  '75': { label: '75 bornes', short: '75', description: 'Bonne cadence.', icon: Milestone },
  '100': { label: '100 bornes', short: '100', description: 'Pied au plancher.', icon: Gauge },
  '200': { label: '200 bornes', short: '200', description: 'Ligne droite ! Deux par joueur au maximum.', icon: Zap },

  feu_rouge: { label: 'Feu rouge', short: 'Stop', description: 'Arrête un adversaire.', icon: OctagonX },
  limite: { label: 'Limite de vitesse', short: '50 max', description: 'L’adversaire ne joue plus que des 25 ou 50.', icon: CircleGauge },
  panne: { label: 'Panne d’essence', short: 'Panne', description: 'Réservoir à sec.', icon: CircleOff },
  crevaison: { label: 'Crevaison', short: 'Crevé', description: 'Un pneu à plat.', icon: Disc3 },
  accident: { label: 'Accident', short: 'Accident', description: 'Tôle froissée.', icon: CarFront },

  feu_vert: { label: 'Feu vert', short: 'Go', description: 'Repart après un Feu rouge.', icon: Navigation },
  fin_limite: { label: 'Fin de limitation', short: 'Libre', description: 'Lève la Limite de vitesse.', icon: Gauge },
  essence: { label: 'Essence', short: 'Plein', description: 'Répare une Panne d’essence.', icon: Fuel },
  roue_secours: { label: 'Roue de secours', short: 'Roue', description: 'Répare une Crevaison.', icon: LifeBuoy },
  reparations: { label: 'Réparations', short: 'Garage', description: 'Répare un Accident.', icon: Wrench },

  vehicule_prioritaire: { label: 'Véhicule prioritaire', short: 'Prioritaire', description: 'Immunité : Feu rouge et Limite de vitesse.', icon: Siren },
  citerne: { label: 'Citerne d’essence', short: 'Citerne', description: 'Immunité : Panne d’essence.', icon: Container },
  increvable: { label: 'Increvable', short: 'Increvable', description: 'Immunité : Crevaison.', icon: ShieldCheck },
  as_du_volant: { label: 'As du volant', short: 'As', description: 'Immunité : Accident.', icon: Award },
}

export const TYPE_LABEL: Record<CardType, string> = {
  distance: 'Distance',
  attack: 'Attaque',
  remedy: 'Parade',
  safety: 'Botte',
}

export const REMEDY_FOR: Record<AttackValue, RemedyValue> = {
  feu_rouge: 'feu_vert',
  limite: 'fin_limite',
  panne: 'essence',
  crevaison: 'roue_secours',
  accident: 'reparations',
}

export const ATTACK_FOR_REMEDY: Record<RemedyValue, AttackValue> = {
  feu_vert: 'feu_rouge',
  fin_limite: 'limite',
  essence: 'panne',
  roue_secours: 'crevaison',
  reparations: 'accident',
}

export const SAFETY_FOR: Record<AttackValue, SafetyValue> = {
  feu_rouge: 'vehicule_prioritaire',
  limite: 'vehicule_prioritaire',
  panne: 'citerne',
  crevaison: 'increvable',
  accident: 'as_du_volant',
}

export const COVERED_BY: Record<SafetyValue, AttackValue[]> = {
  vehicule_prioritaire: ['feu_rouge', 'limite'],
  citerne: ['panne'],
  increvable: ['crevaison'],
  as_du_volant: ['accident'],
}

export const HAZARDS: AttackValue[] = ['feu_rouge', 'panne', 'crevaison', 'accident']
export const ALL_SAFETIES: SafetyValue[] = ['vehicule_prioritaire', 'citerne', 'increvable', 'as_du_volant']

/** Composition du paquet (identique à _deck_composition() côté SQL) : 106 cartes. */
export const DECK_COMPOSITION: { type: CardType; value: CardValue; qty: number }[] = [
  { type: 'distance', value: '25', qty: 10 },
  { type: 'distance', value: '50', qty: 10 },
  { type: 'distance', value: '75', qty: 10 },
  { type: 'distance', value: '100', qty: 12 },
  { type: 'distance', value: '200', qty: 4 },
  { type: 'attack', value: 'feu_rouge', qty: 5 },
  { type: 'attack', value: 'limite', qty: 4 },
  { type: 'attack', value: 'panne', qty: 3 },
  { type: 'attack', value: 'crevaison', qty: 3 },
  { type: 'attack', value: 'accident', qty: 3 },
  { type: 'remedy', value: 'feu_vert', qty: 14 },
  { type: 'remedy', value: 'fin_limite', qty: 6 },
  { type: 'remedy', value: 'essence', qty: 6 },
  { type: 'remedy', value: 'roue_secours', qty: 6 },
  { type: 'remedy', value: 'reparations', qty: 6 },
  { type: 'safety', value: 'vehicule_prioritaire', qty: 1 },
  { type: 'safety', value: 'citerne', qty: 1 },
  { type: 'safety', value: 'increvable', qty: 1 },
  { type: 'safety', value: 'as_du_volant', qty: 1 },
]

export const GOAL = 1000

/** Couleurs attribuées aux joueurs (voitures sur la piste) */
export const PLAYER_COLORS = ['#e8532b', '#f6c21c', '#3fb8a8', '#8fb3ff', '#f08fb6', '#b9e769']
