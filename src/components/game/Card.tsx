import { motion } from 'framer-motion'
import { CARD_INFO, TYPE_LABEL } from '../../lib/deck'
import { CardArt } from './CardArt'
import type { CardType, CardValue } from '../../types/game'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'fill'

interface CardProps {
  type: CardType
  value: CardValue
  size?: Size
  selected?: boolean
  dimmed?: boolean
  onClick?: () => void
  /** Animation de pose (carte qui « claque » sur la table) */
  animateIn?: boolean
  className?: string
}

const SIZES: Record<Size, string> = {
  xs: 'w-9 rounded-md',
  sm: 'w-14 rounded-lg',
  md: 'w-[5.4rem] rounded-xl',
  lg: 'w-32 rounded-2xl',
  fill: 'w-full rounded-xl',
}

/** Un fond plein par famille ; la couleur suffit à reconnaître le type. */
const THEMES: Record<CardType, { face: string; ink: string; accent: string }> = {
  distance: { face: 'bg-cream-100', ink: 'text-night-900', accent: 'bg-flame-500' },
  attack: { face: 'bg-flame-500', ink: 'text-cream-50', accent: 'bg-night-900/25' },
  remedy: { face: 'bg-go-500', ink: 'text-cream-50', accent: 'bg-night-900/20' },
  safety: { face: 'bg-signal-400', ink: 'text-night-900', accent: 'bg-night-900/15' },
}

export function Card({ type, value, size = 'md', selected, dimmed, onClick, animateIn, className = '' }: CardProps) {
  const info = CARD_INFO[value]
  const theme = THEMES[type]
  const tiny = size === 'xs' || size === 'sm'
  const Comp = onClick ? motion.button : motion.div

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={`${TYPE_LABEL[type]} : ${info.label}`}
      initial={animateIn ? { scale: 1.5, rotate: -10, opacity: 0, y: -30 } : false}
      animate={{ scale: 1, rotate: 0, opacity: dimmed ? 0.4 : 1, y: selected ? -10 : 0 }}
      whileTap={onClick ? { scale: 0.93 } : undefined}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className={`@container relative block shrink-0 aspect-[5/7] overflow-hidden select-none ${SIZES[size]} ${theme.face} ${theme.ink} ${
        selected ? 'ring-[3px] ring-cream-50' : ''
      } shadow-[0_6px_14px_-6px_rgb(0_0_0/0.7)] ${className}`}
    >
      {/* Filet intérieur façon carte imprimée */}
      <span className="pointer-events-none absolute inset-[5%] rounded-[inherit] border border-current opacity-25" />

      {type === 'distance' ? (
        <span className="relative flex h-full flex-col items-center justify-center">
          {/* Tête de borne */}
          <span className={`absolute inset-x-0 top-0 h-[16%] ${theme.accent}`} />
          <span className="mt-[10%] font-display text-[34cqw] leading-none tracking-tight">{value}</span>
          {!tiny && <span className="mt-[6%] text-[11cqw] font-extrabold uppercase tracking-[0.18em] opacity-60">bornes</span>}
        </span>
      ) : (
        <span className="relative flex h-full flex-col items-center justify-between px-[7%] py-[8%]">
          {!tiny && (
            <span className="text-[8.5cqw] font-extrabold uppercase leading-none tracking-[0.14em] opacity-80">
              {TYPE_LABEL[type]}
            </span>
          )}
          <CardArt type={type} value={value} className={tiny ? 'm-auto w-[86%]' : 'w-[72%] drop-shadow-[0_2px_0_rgb(0_0_0/0.25)]'} />
          {!tiny && (
            <span className="text-center text-[12.5cqw] font-extrabold leading-[1.05] [text-wrap:balance]">{info.label}</span>
          )}
        </span>
      )}
    </Comp>
  )
}

/** Dos de carte (pioche) */
export function CardBack({ size = 'md', count }: { size?: Size; count?: number }) {
  return (
    <div className={`@container relative aspect-[5/7] overflow-hidden bg-night-700 ${SIZES[size]} shadow-[0_10px_24px_-10px_rgb(0_0_0/0.8)]`}>
      <div className="absolute inset-[6%] rounded-[inherit] border border-cream-100/25" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="font-display text-[22cqw] leading-none text-cream-100">{count ?? '1K'}</div>
          <div className="mt-1 text-[9cqw] font-bold uppercase tracking-[0.2em] text-cream-100/50">cartes</div>
        </div>
      </div>
    </div>
  )
}
