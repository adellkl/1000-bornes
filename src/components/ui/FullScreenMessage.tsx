import { LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'

export function FullScreenMessage({ title, children, loading }: { title?: string; children?: ReactNode; loading?: boolean }) {
  return (
    <main className="grid min-h-app place-items-center bg-asphalt px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-5">
        <Logo />
        {loading && <LoaderCircle className="size-8 animate-spin text-signal-400" />}
        {title && <h1 className="text-xl font-extrabold">{title}</h1>}
        {children}
        {!loading && (
          <Link to="/" className="text-sm font-bold text-night-300 underline underline-offset-4 hover:text-cream-100">
            Retour à l’accueil
          </Link>
        )}
      </div>
    </main>
  )
}
