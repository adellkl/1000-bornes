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
    <header className={`flex items-center justify-between gap-3 ${large ? 'px-8 py-5' : 'px-4 py-3'}`}>
      <Logo size={large ? 'md' : 'sm'} />
      <div className="flex items-center gap-2">
        {deckCount !== undefined && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-night-800 px-3 py-1.5 text-xs font-bold ring-1 ring-cream-100/10">
            <Layers className="size-3.5 text-signal-400" />
            {deckCount}
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-night-800 px-3 py-1.5 font-display ring-1 ring-cream-100/10 ${large ? 'text-base' : 'text-xs'}`}
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
