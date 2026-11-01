import { ChevronLeft, Flag } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import { Notice } from '../components/ui/Notice'
import { call } from '../lib/firebase'

const NAME_KEY = 'route1000-name'

export default function CreateGamePage() {
  const navigate = useNavigate()
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '')
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Indiquez votre prénom.')
    setLoading(true)
    setError(null)
    try {
      localStorage.setItem(NAME_KEY, name.trim())
      const code = await call<string>('createroom', { name: name.trim(), maxPlayers })
      navigate(`/screen/${code}`)
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-app place-items-center bg-asphalt px-5 py-10">
      <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-6 rounded-[2rem] bg-night-800/85 p-7 ring-1 ring-cream-100/10">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Retour" className="grid size-10 place-items-center rounded-full bg-night-700 hover:bg-night-600">
            <ChevronLeft className="size-5" />
          </Link>
          <Logo size="sm" />
          <span className="size-10" />
        </div>
        <div>
          <h1 className="font-display text-3xl">Nouvelle partie</h1>
          <p className="mt-1 text-sm text-night-300">Cet ordinateur deviendra le plateau de jeu.</p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold">Prénom de l’hôte</span>
          <input
            autoFocus
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Sacha"
            className="h-14 rounded-2xl bg-cream-50 px-4 text-lg font-bold text-night-900 placeholder:text-night-300 focus:outline-none focus:ring-4 focus:ring-signal-400"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold">Nombre maximum de joueurs</legend>
          <div className="grid grid-cols-5 gap-2">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={maxPlayers === n}
                onClick={() => setMaxPlayers(n)}
                className={`h-14 rounded-2xl font-display text-xl transition-colors ${
                  maxPlayers === n ? 'bg-signal-400 text-night-900' : 'bg-night-700 text-cream-100 hover:bg-night-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <Notice message={error} />
        <Button type="submit" size="lg" loading={loading} icon={<Flag className="size-5" />}>
          Créer la salle
        </Button>
      </form>
    </main>
  )
}
