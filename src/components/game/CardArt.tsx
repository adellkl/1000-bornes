import type { CardType, CardValue } from '../../types/game'

/**
 * Illustrations originales des cartes spéciales, façon panneaux routiers.
 * Chaque pictogramme est dessiné dans un repère 100 × 100.
 */

const NIGHT = '#0b1626'
const RED = '#e8532b'
const GREEN = '#2f9e6b'
const YELLOW = '#f6c21c'
const CREAM = '#fbf6ea'
const GREY = '#8ea3bf'

function TrafficLight({ lit }: { lit: 'red' | 'green' }) {
  return (
    <g>
      <rect x="37" y="16" width="26" height="62" rx="9" fill={NIGHT} />
      <rect x="47" y="78" width="6" height="10" fill={NIGHT} />
      <circle cx="50" cy="30" r="8" fill={lit === 'red' ? RED : '#3a2a2a'} />
      <circle cx="50" cy="47" r="8" fill="#3d3a26" />
      <circle cx="50" cy="64" r="8" fill={lit === 'green' ? '#3fd68f' : '#1f3a2c'} />
      {lit === 'red' && <circle cx="50" cy="30" r="12" fill={RED} opacity="0.25" />}
      {lit === 'green' && <circle cx="50" cy="64" r="12" fill="#3fd68f" opacity="0.25" />}
    </g>
  )
}

function SpeedSign({ ended }: { ended?: boolean }) {
  return (
    <g>
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fontFamily="Bungee, Arial Black, sans-serif"
        fontSize="34"
        fill={ended ? GREY : NIGHT}
      >
        50
      </text>
      {ended && (
        <g stroke={NIGHT} strokeWidth="3.5">
          <line x1="22" y1="70" x2="70" y2="22" />
          <line x1="28" y1="77" x2="77" y2="28" />
          <line x1="35" y1="83" x2="83" y2="35" />
        </g>
      )}
    </g>
  )
}

function FuelPump({ empty }: { empty?: boolean }) {
  return (
    <g>
      <rect x="28" y="22" width="30" height="58" rx="5" fill={NIGHT} />
      <rect x="33" y="28" width="20" height="14" rx="2" fill={CREAM} />
      {/* jauge */}
      <path d="M36 39 a7 7 0 0 1 14 0" fill="none" stroke={NIGHT} strokeWidth="2" />
      <line x1="43" y1="39" x2={empty ? 37 : 49} y2={empty ? 34 : 33} stroke={empty ? RED : GREEN} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="24" y="78" width="38" height="6" rx="2" fill={NIGHT} />
      {/* tuyau et pistolet */}
      <path d="M58 34 h8 a4 4 0 0 1 4 4 v26 a4 4 0 0 0 8 0 v-20 l-6 -8" fill="none" stroke={NIGHT} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {empty ? (
        <text x="43" y="66" textAnchor="middle" fontFamily="Bungee, Arial Black, sans-serif" fontSize="16" fill={RED}>
          !
        </text>
      ) : (
        <path d="M43 52 c-6 8 -7 11 -7 14 a7 7 0 0 0 14 0 c0 -3 -1 -6 -7 -14z" fill={YELLOW} />
      )}
    </g>
  )
}

function Tire({ flat, spare }: { flat?: boolean; spare?: boolean }) {
  return (
    <g>
      {flat ? (
        <>
          <ellipse cx="50" cy="56" rx="30" ry="24" fill={NIGHT} />
          <ellipse cx="50" cy="56" rx="13" ry="10" fill={GREY} />
          <rect x="18" y="76" width="64" height="6" rx="3" fill={NIGHT} />
          {/* clou */}
          <path d="M66 22 l-9 26" stroke={GREY} strokeWidth="3" strokeLinecap="round" />
          <rect x="61" y="17" width="12" height="4" rx="1.5" fill={GREY} transform="rotate(18 67 19)" />
          {/* air qui s'échappe */}
          <path d="M74 40 q6 -3 10 1 M76 48 q7 -2 10 3" stroke={RED} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="30" fill={NIGHT} />
          {Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x="48" y="18" width="4" height="7" fill="#26436a" transform={`rotate(${i * 30} 50 50)`} />
          ))}
          <circle cx="50" cy="50" r="14" fill={GREY} />
          <circle cx="50" cy="50" r="4" fill={NIGHT} />
          {spare && (
            <g>
              <circle cx="74" cy="26" r="11" fill={GREEN} stroke={CREAM} strokeWidth="2.5" />
              <path d="M74 20 v12 M68 26 h12" stroke={CREAM} strokeWidth="3" strokeLinecap="round" />
            </g>
          )}
        </>
      )}
    </g>
  )
}

function Crash() {
  return (
    <g>
      {/* éclat central */}
      <path d="M50 26 l5 13 13 -6 -6 13 13 5 -13 5 6 13 -13 -6 -5 13 -5 -13 -13 6 6 -13 -13 -5 13 -5 -6 -13 13 6z" fill={YELLOW} stroke={RED} strokeWidth="2" />
      {/* deux voitures */}
      <g transform="rotate(-12 26 62)">
        <rect x="8" y="56" width="30" height="13" rx="4" fill={NIGHT} />
        <path d="M13 56 l5 -8 h12 l5 8z" fill={NIGHT} />
        <circle cx="16" cy="70" r="4" fill={GREY} />
        <circle cx="31" cy="70" r="4" fill={GREY} />
      </g>
      <g transform="rotate(12 74 62)">
        <rect x="62" y="56" width="30" height="13" rx="4" fill={NIGHT} />
        <path d="M66 56 l5 -8 h12 l5 8z" fill={NIGHT} />
        <circle cx="69" cy="70" r="4" fill={GREY} />
        <circle cx="84" cy="70" r="4" fill={GREY} />
      </g>
    </g>
  )
}

function Tools() {
  return (
    <g strokeLinecap="round">
      {/* clé plate */}
      <g transform="rotate(45 50 50)">
        <rect x="46" y="22" width="8" height="52" rx="3" fill={NIGHT} />
        <path d="M40 22 a10 10 0 1 1 20 0 l-4 0 v-6 h-12 v6z" fill={NIGHT} />
      </g>
      {/* tournevis */}
      <g transform="rotate(-45 50 50)">
        <rect x="47.5" y="20" width="5" height="34" fill={GREY} />
        <rect x="44" y="52" width="12" height="26" rx="5" fill={RED} />
      </g>
    </g>
  )
}

function Siren() {
  return (
    <g>
      <g stroke={RED} strokeWidth="4" strokeLinecap="round">
        <line x1="50" y1="12" x2="50" y2="22" />
        <line x1="20" y1="26" x2="27" y2="33" />
        <line x1="80" y1="26" x2="73" y2="33" />
        <line x1="12" y1="52" x2="22" y2="52" />
        <line x1="88" y1="52" x2="78" y2="52" />
      </g>
      <path d="M30 70 v-18 a20 20 0 0 1 40 0 v18z" fill={RED} />
      <path d="M38 56 a12 12 0 0 1 12 -12" stroke={CREAM} strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="24" y="70" width="52" height="12" rx="3" fill={NIGHT} />
    </g>
  )
}

function Tanker() {
  return (
    <g>
      <rect x="10" y="38" width="56" height="26" rx="13" fill={NIGHT} />
      <rect x="18" y="48" width="40" height="4" rx="2" fill={YELLOW} />
      <path d="M68 44 h12 l9 11 v12 h-21z" fill={NIGHT} />
      <rect x="72" y="47" width="8" height="7" rx="1" fill={GREY} />
      <rect x="8" y="64" width="83" height="5" rx="2" fill={NIGHT} />
      {[22, 40, 78].map((x) => (
        <g key={x}>
          <circle cx={x} cy="71" r="7" fill={NIGHT} />
          <circle cx={x} cy="71" r="3" fill={GREY} />
        </g>
      ))}
      <path d="M38 22 c-5 7 -6 9 -6 11 a6 6 0 0 0 12 0 c0 -2 -1 -4 -6 -11z" fill={YELLOW} />
    </g>
  )
}

function ShieldTire() {
  return (
    <g>
      <circle cx="42" cy="52" r="26" fill={NIGHT} />
      <circle cx="42" cy="52" r="11" fill={GREY} />
      <path d="M70 34 l16 6 v12 c0 11 -7 18 -16 22 c-9 -4 -16 -11 -16 -22 v-12z" fill={YELLOW} stroke={NIGHT} strokeWidth="3" />
      <path d="M63 53 l5 5 10 -11" stroke={NIGHT} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

function SteeringWheel() {
  return (
    <g>
      <circle cx="50" cy="54" r="27" fill="none" stroke={NIGHT} strokeWidth="8" />
      <circle cx="50" cy="54" r="7" fill={NIGHT} />
      <path d="M24 50 h52 M50 61 v20" stroke={NIGHT} strokeWidth="7" strokeLinecap="round" />
      <path d="M50 8 l4 9 10 1 -8 6 3 10 -9 -5 -9 5 3 -10 -8 -6 10 -1z" fill={YELLOW} stroke={NIGHT} strokeWidth="2" strokeLinejoin="round" />
    </g>
  )
}

const ART: Partial<Record<CardValue, () => React.ReactElement>> = {
  feu_rouge: () => <TrafficLight lit="red" />,
  feu_vert: () => <TrafficLight lit="green" />,
  limite: () => <SpeedSign />,
  fin_limite: () => <SpeedSign ended />,
  panne: () => <FuelPump empty />,
  essence: () => <FuelPump />,
  crevaison: () => <Tire flat />,
  roue_secours: () => <Tire spare />,
  accident: () => <Crash />,
  reparations: () => <Tools />,
  vehicule_prioritaire: () => <Siren />,
  citerne: () => <Tanker />,
  increvable: () => <ShieldTire />,
  as_du_volant: () => <SteeringWheel />,
}

/** Pastille illustrée : panneau d'interdiction (attaque), d'indication (parade) ou écusson (botte) */
export function CardArt({ type, value, className = '' }: { type: CardType; value: CardValue; className?: string }) {
  const Art = ART[value]
  if (!Art) return null
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {type === 'safety' ? (
        <path d="M50 3 l42 15 v28 c0 27 -18 43 -42 51 c-24 -8 -42 -24 -42 -51 v-28z" fill={CREAM} stroke={NIGHT} strokeWidth="4" />
      ) : (
        <>
        {/* liseré sombre : la pastille ressort sur le fond rouge ou vert de la carte */}
        <circle cx="50" cy="50" r="49" fill={NIGHT} />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill={CREAM}
          stroke={type === 'attack' ? RED : value === 'fin_limite' ? GREY : GREEN}
          strokeWidth={type === 'attack' ? 9 : 7}
        />
        </>
      )}
      <g transform={type === 'safety' ? 'translate(10 6) scale(0.8)' : 'translate(9 9) scale(0.82)'}>
        <Art />
      </g>
    </svg>
  )
}
