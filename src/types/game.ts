export type CardType = 'distance' | 'attack' | 'remedy' | 'safety'

export type AttackValue = 'feu_rouge' | 'limite' | 'panne' | 'crevaison' | 'accident'
export type RemedyValue = 'feu_vert' | 'fin_limite' | 'essence' | 'roue_secours' | 'reparations'
export type SafetyValue = 'vehicule_prioritaire' | 'citerne' | 'increvable' | 'as_du_volant'
export type DistanceValue = '25' | '50' | '75' | '100' | '200'
export type CardValue = AttackValue | RemedyValue | SafetyValue | DistanceValue

export interface Card {
  id: string
  type: CardType
  value: CardValue
}

export type RoomStatus = 'lobby' | 'playing' | 'finished'

export interface PendingAttack {
  target_id: string
  attacker_id: string
  attack: AttackValue
  expires_at: string
}

export interface Room {
  id: string
  code: string
  status: RoomStatus
  max_players: number
  current_player_id: string | null
  winner_id: string | null
  host_player_id: string | null
  pending_attack: PendingAttack | null
  turn_number: number
  version: number
  deck_count: number
  discard_top: Card | null
  is_host: boolean
  is_screen_owner: boolean
  host_claim_token: string | null
}

export interface Player {
  id: string
  name: string
  position: number
  distance: number
  hand_count: number
  attacks: AttackValue[]
  protections: SafetyValue[]
  coup_fourres: SafetyValue[]
  count_200: number
  is_connected: boolean
  is_me: boolean
}

export type EventAction =
  | 'join'
  | 'start'
  | 'restart'
  | 'play_distance'
  | 'play_remedy'
  | 'play_attack'
  | 'play_safety'
  | 'coup_fourre'
  | 'discard'
  | 'finish'
  | 'kick'

export interface GameEvent {
  id: number
  player_id: string | null
  action: EventAction
  payload: {
    card_type?: CardType
    card_value?: CardValue
    player_name?: string
    target_id?: string
    target_name?: string
    name?: string
    attack?: AttackValue
    winner_name?: string
    reason?: 'exact_1000' | 'deck_empty' | 'forfeit'
    distance?: number
  }
  created_at: string
}

export interface GameState {
  room: Room
  players: Player[]
  me: { player_id: string; hand: Card[] } | null
  events: GameEvent[]
  server_time: string
}

export interface PlayOption {
  playable: boolean
  reason?: string
  /** Pour une attaque : les adversaires pouvant être ciblés */
  targets?: Player[]
}
