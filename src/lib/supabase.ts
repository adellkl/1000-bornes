import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'public-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Une session par onglet permet de tester plusieurs joueurs dans le même navigateur
    // (activé avec ?tab=1 dans l'URL, voir README).
    storageKey: sessionStorageKey(),
  },
  realtime: { params: { eventsPerSecond: 10 } },
})

function sessionStorageKey(): string {
  if (typeof window === 'undefined') return 'route1000-auth'
  const params = new URLSearchParams(window.location.search)
  let tab = sessionStorage.getItem('route1000-tab')
  if (params.has('tab')) {
    tab = params.get('tab') || crypto.randomUUID().slice(0, 8)
    sessionStorage.setItem('route1000-tab', tab)
  }
  return tab ? `route1000-auth-${tab}` : 'route1000-auth'
}

let sessionPromise: Promise<string> | null = null

/** Garantit une session anonyme Supabase et renvoie l'id utilisateur. */
export function ensureSession(): Promise<string> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) return data.session.user.id
      const { data: signed, error } = await supabase.auth.signInAnonymously()
      if (error || !signed.user) {
        sessionPromise = null
        throw new Error(
          error?.message.includes('Anonymous sign-ins are disabled')
            ? 'La connexion anonyme est désactivée dans Supabase (Authentication → Sign In / Providers).'
            : 'Impossible de se connecter au serveur de jeu.',
        )
      }
      return signed.user.id
    })()
  }
  return sessionPromise
}

/** Appel RPC authentifié avec message d'erreur en français */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  await ensureSession()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(friendlyError(error.message))
  return data as T
}

function friendlyError(message: string): string {
  if (message.includes('Failed to fetch')) return 'Connexion au serveur impossible. Vérifiez votre réseau.'
  if (message.includes('JWT')) return 'Session expirée : rechargez la page.'
  return message
}

/** URL publique utilisée pour les liens et QR codes */
export function publicUrl(path: string): string {
  const base = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || window.location.origin
  return `${base.replace(/\/$/, '')}${path}`
}
