import { RouterProvider } from 'react-router-dom'
import { isFirebaseConfigured } from './lib/firebase'
import { router } from './routes'

function MissingConfig() {
  return (
    <main className="grid min-h-dvh place-items-center bg-asphalt p-6">
      <div className="max-w-md rounded-3xl bg-night-800 p-6 ring-1 ring-flame-500/40">
        <h1 className="font-display text-2xl text-signal-400">Configuration requise</h1>
        <p className="mt-3 text-sm text-cream-200">
          Copiez <code className="rounded bg-night-900 px-1">.env.example</code> en{' '}
          <code className="rounded bg-night-900 px-1">.env</code> et renseignez la configuration Firebase{' '}
          (<code className="rounded bg-night-900 px-1">VITE_FIREBASE_*</code>), puis relancez le serveur.
        </p>
      </div>
    </main>
  )
}

export default function App() {
  return isFirebaseConfigured ? <RouterProvider router={router} /> : <MissingConfig />
}
