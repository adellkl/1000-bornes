import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  signInAnonymously,
} from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions'

const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
}
const useEmulators = env.VITE_FIREBASE_EMULATORS === 'true'

export const isFirebaseConfigured = Boolean(config.projectId && (useEmulators || (config.apiKey && config.appId)))

const app = initializeApp({
  ...config,
  apiKey: config.apiKey || 'demo-key',
  projectId: config.projectId || 'demo-route-1000',
})
export const auth = getAuth(app)
export const db = getFirestore(app)
const functions = getFunctions(app, (env.VITE_FIREBASE_REGION as string | undefined) || 'europe-west1')

if (useEmulators) {
  const host = window.location.hostname
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
  connectFirestoreEmulator(db, host, 8085)
  connectFunctionsEmulator(functions, host, 5001)
}

/**
 * Une session par onglet avec ?tab=… (pratique pour simuler plusieurs joueurs
 * dans un seul navigateur) ; sinon la session est partagée et persistante.
 */
function wantsTabSession(): boolean {
  const params = new URLSearchParams(window.location.search)
  if (params.has('tab')) sessionStorage.setItem('route1000-tab', params.get('tab') || '1')
  return sessionStorage.getItem('route1000-tab') !== null
}

let sessionPromise: Promise<string> | null = null

/** Garantit une session anonyme Firebase et renvoie l'uid. */
export function ensureSession(): Promise<string> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      await setPersistence(auth, wantsTabSession() ? browserSessionPersistence : browserLocalPersistence)
      await auth.authStateReady()
      if (auth.currentUser) return auth.currentUser.uid
      try {
        const { user } = await signInAnonymously(auth)
        return user.uid
      } catch (e) {
        sessionPromise = null
        const code = (e as { code?: string }).code
        throw new Error(
          code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation'
            ? 'La connexion anonyme est désactivée dans Firebase (Authentication → Sign-in method).'
            : 'Impossible de se connecter au serveur de jeu.',
        )
      }
    })()
  }
  return sessionPromise
}

/** Appelle une Cloud Function de jeu (validée côté serveur) avec un message d'erreur en français. */
export async function call<T = unknown>(name: string, data: Record<string, unknown>): Promise<T> {
  await ensureSession()
  try {
    const result = await httpsCallable(functions, name)(data)
    return result.data as T
  } catch (e) {
    const err = e as { code?: string; message?: string }
    if (err.code === 'functions/unavailable')
      throw new Error('Connexion au serveur impossible. Vérifiez votre réseau.')
    // Fonction absente (non déployée) ou réseau coupé : le SDK ne renvoie que « internal »
    if (err.code === 'functions/internal' && (!err.message || err.message === 'internal'))
      throw new Error('Serveur de jeu injoignable : les Cloud Functions ne sont pas déployées ou le réseau est coupé.')
    throw new Error(err.message || 'Erreur inattendue, réessayez.')
  }
}

/** URL publique utilisée pour les liens et QR codes */
export function publicUrl(path: string): string {
  const base = (env.VITE_PUBLIC_URL as string | undefined) || window.location.origin
  return `${base.replace(/\/$/, '')}${path}`
}
