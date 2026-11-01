import { motion } from 'framer-motion'
import { ArrowRight, Monitor, Smartphone } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/game/Card'
import { Button } from '../components/ui/Button'
import { Logo } from '../components/ui/Logo'
import type { CardType, CardValue } from '../types/game'

const FAN: { type: CardType; value: CardValue }[] = [
  { type: 'distance', value: '100' },
  { type: 'attack', value: 'crevaison' },
  { type: 'safety', value: 'as_du_volant' },
  { type: 'remedy', value: 'feu_vert' },
  { type: 'distance', value: '200' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  const join = (e: FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length >= 4) navigate(`/join/${clean}`)
  }

  return (
    <main className="min-h-dvh overflow-hidden bg-asphalt">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center gap-10 px-5 py-12">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center">
          <Logo size="xl" />
          <p className="mx-auto mt-4 max-w-md text-lg font-semibold text-cream-200">
            La course de cartes entre amis : le plateau sur grand écran, votre main dans la poche.
          </p>
        </motion.div>

        <div className="relative flex h-44 w-full max-w-md justify-center" aria-hidden>
          {FAN.map((c, i) => (
            <motion.div
              key={c.value}
              className="absolute bottom-0 origin-bottom"
              initial={{ rotate: 0, y: 60, opacity: 0 }}
              animate={{ rotate: (i - 2) * 11, y: Math.abs(i - 2) * 8, x: (i - 2) * 46, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.07, type: 'spring', stiffness: 160, damping: 16 }}
            >
              <Card type={c.type} value={c.value} size="md" />
            </motion.div>
          ))}
        </div>

        <div className="grid w-full max-w-3xl gap-4 md:grid-cols-2">
          <section className="flex flex-col gap-4 rounded-3xl bg-night-800/80 p-6 ring-1 ring-cream-100/10">
            <div className="flex items-center gap-2 text-sm font-bold text-night-300">
              <Monitor className="size-4 text-signal-400" /> Sur l’ordinateur
            </div>
            <p className="text-sm text-cream-200">Créez la salle et affichez le plateau en grand écran.</p>
            <Button size="lg" onClick={() => navigate('/create')} icon={<ArrowRight className="size-5" />} className="mt-auto">
              Créer une partie
            </Button>
          </section>

          <form onSubmit={join} className="flex flex-col gap-4 rounded-3xl bg-night-800/80 p-6 ring-1 ring-cream-100/10">
            <label htmlFor="code" className="flex items-center gap-2 text-sm font-bold text-night-300">
              <Smartphone className="size-4 text-signal-400" /> Rejoindre une partie
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={6}
              placeholder="CODE"
              autoCapitalize="characters"
              autoComplete="off"
              className="h-14 rounded-2xl bg-cream-50 text-center font-display text-2xl tracking-[0.3em] text-night-900 placeholder:text-night-300/60 focus:outline-none focus:ring-4 focus:ring-signal-400"
            />
            <Button type="submit" size="lg" variant="secondary" disabled={code.length < 4}>
              Rejoindre
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
