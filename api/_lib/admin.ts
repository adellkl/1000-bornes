import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * SDK Admin Firebase (forfait gratuit Spark) utilisé par les fonctions Vercel.
 * En production : clé de compte de service dans FIREBASE_SERVICE_ACCOUNT (JSON).
 * En local : émulateurs (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST).
 */
function init() {
  if (getApps().length) return getApps()[0]
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (raw) {
    const account = JSON.parse(raw)
    return initializeApp({ credential: cert(account), projectId: account.project_id })
  }
  return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-route-1000' })
}

const app = init()
export const db = getFirestore(app)
export const adminAuth = getAuth(app)

try {
  db.settings({ ignoreUndefinedProperties: true })
} catch {
  // déjà configuré (réutilisation de l'instance entre deux appels)
}
