export function Logo({ size = 'md', compact }: { size?: 'sm' | 'md' | 'xl'; compact?: boolean }) {
  const text = size === 'xl' ? 'text-[clamp(2rem,10vw,4.5rem)]' : size === 'md' ? 'text-2xl' : 'text-lg'
  return (
    <div className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap" aria-label="Route 1000">
      <svg viewBox="0 0 60 72" className={size === 'xl' ? 'h-[clamp(3rem,14vw,6rem)]' : size === 'md' ? 'h-9' : 'h-7'} aria-hidden>
        <path d="M8 70V30a22 22 0 0 1 44 0v40z" fill="#f4ead5" stroke="#070f1b" strokeWidth="3" />
        <path d="M8.5 30a21.5 21.5 0 0 1 43 0v4h-43z" fill="#e8532b" stroke="#070f1b" strokeWidth="3" />
        <text x="30" y="58" textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize="17" fill="#0b1626">1K</text>
      </svg>
      <span className={`font-display leading-none ${text} ${compact ? 'max-[359px]:hidden' : ''}`}>
        Route <span className="text-signal-400">1000</span>
      </span>
    </div>
  )
}
