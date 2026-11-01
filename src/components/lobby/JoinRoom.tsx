import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Notice'

interface JoinRoomProps {
  code: string
  onJoin: (name: string) => Promise<void>
  disabledReason?: string | null
}

const NAME_KEY = 'route1000-name'

export function JoinRoom({ code, onJoin, disabledReason }: JoinRoomProps) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Indiquez votre prénom.')
    setLoading(true)
    setError(null)
    try {
      localStorage.setItem(NAME_KEY, trimmed)
      await onJoin(trimmed)
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-4">
      <div className="text-center">
        <div className="text-xs font-bold uppercase tracking-wider text-night-300">Salle</div>
        <div className="font-display text-4xl tracking-widest text-signal-400">{code}</div>
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-bold">Votre prénom</span>
        <input
          autoFocus
          value={name}
          maxLength={20}
          autoComplete="given-name"
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex. Camille"
          className="h-14 rounded-2xl bg-cream-50 px-4 text-lg font-bold text-night-900 placeholder:text-night-300 focus:outline-none focus:ring-4 focus:ring-signal-400"
        />
      </label>
      <Notice message={error ?? disabledReason ?? null} />
      <Button type="submit" size="lg" loading={loading} disabled={Boolean(disabledReason)} icon={<ArrowRight className="size-5" />}>
        Rejoindre la partie
      </Button>
    </form>
  )
}
