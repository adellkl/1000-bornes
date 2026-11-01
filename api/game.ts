/**
 * Point d'entrée unique du serveur de jeu (fonction serverless Vercel, gratuite).
 * POST /api/game  { action, ...données }  avec  Authorization: Bearer <jeton Firebase>
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ACTIONS, GameError } from './_lib/actions.js'
import { adminAuth } from './_lib/admin.js'

type Req = IncomingMessage & { body?: unknown }
type Res = ServerResponse

function send(res: Res, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(req: Req, res: Res) {
  // GET : préchauffage (réveille la fonction et le SDK Admin avant le premier coup)
  if (req.method === 'GET') return send(res, 200, { ok: true })
  if (req.method !== 'POST') return send(res, 405, { error: 'Méthode non autorisée.' })

  let uid: string
  try {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    uid = (await adminAuth.verifyIdToken(token)).uid
  } catch {
    return send(res, 401, { error: 'Session expirée : rechargez la page.' })
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {}) as Record<string, unknown>
  const action = ACTIONS[String(body.action)]
  if (!action) return send(res, 400, { error: 'Action inconnue.' })

  try {
    const result = await action(uid, body)
    return send(res, 200, { result: result ?? null })
  } catch (e) {
    if (e instanceof GameError) return send(res, 400, { error: e.message })
    console.error(e)
    return send(res, 500, { error: 'Erreur du serveur de jeu, réessayez.' })
  }
}
