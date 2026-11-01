// Serveur local qui exécute api/game.ts comme Vercel (utilisé avec les émulateurs Firebase).
// Lancé par `npm run dev:api` ; Vite redirige /api vers ce serveur.
import { createServer } from 'node:http'
import handler from '../api/game.js'

const PORT = Number(process.env.API_PORT || 3001)

createServer(async (req, res) => {
  if (!req.url?.startsWith('/api/game')) {
    res.statusCode = 404
    return res.end()
  }
  let raw = ''
  for await (const chunk of req) raw += chunk
  Object.assign(req, { body: raw ? JSON.parse(raw) : {} })
  await handler(req, res)
}).listen(PORT, () => console.log(`API de jeu locale sur http://localhost:${PORT}/api/game`))
