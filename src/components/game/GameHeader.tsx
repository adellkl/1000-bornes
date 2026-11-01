import { Layers, Radio } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo } from '../ui/Logo'

interface GameHeaderProps {
  code: string
  deckCount?: number
  live: boolean
  right?: ReactNode
  large?: boolean
}

export function GameHeader({ code, deckCount, live, right, large }: GameHeaderProps) {
  return (
    <header className={`flex shrink-0 items-center justify-between gap-2 ${large ? 'px-3 py-3 sm:px-6 sm:py-4 2xl:px-10 2xl:py-6' : 'px-3 py-2.5 short:py-1.5'}`}>
      <div className={large ? 'max-sm:[&_span]:text-lg max-sm:[&_svg]:h-7 2xl:[&_span]:text-4xl 2xl:[&_svg]:h-14' : ''}>
        <Logo size={large ? 'md' : 'sm'} compact />
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        {deckCount !== undefined && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-night-800 px-3 py-1.5 text-xs font-bold ring-1 ring-cream-100/10">
            <Layers className="size-3.5 text-signal-400" />
            {deckCount}
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-night-800 px-3 py-1.5 font-display ring-1 ring-cream-100/10 ${large ? 'text-xs sm:text-base 2xl:px-5 2xl:py-2.5 2xl:text-2xl' : 'text-xs'}`}
          title={live ? 'Synchronisé en temps réel' : 'Reconnexion…'}
        >
          <Radio className={`size-3.5 ${live ? 'text-go-400' : 'animate-pulse text-flame-400'}`} />
          {code}
        </span>
        {right}
      </div>
    </header>
  )
}
