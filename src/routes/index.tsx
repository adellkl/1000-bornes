import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { FullScreenMessage } from '../components/ui/FullScreenMessage'
import HomePage from '../pages/HomePage'

// Les pages sont chargées à la demande : un téléphone qui rejoint ne télécharge pas l'écran de plateau.
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default })

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/create', lazy: page(() => import('../pages/CreateGamePage')) },
  { path: '/join/:roomCode', lazy: page(() => import('../pages/JoinGamePage')) },
  { path: '/lobby/:roomCode', lazy: page(() => import('../pages/LobbyPage')) },
  { path: '/game/:roomCode', lazy: page(() => import('../pages/GamePage')) },
  { path: '/screen/:roomCode', lazy: page(() => import('../pages/ScreenPage')) },
  { path: '*', element: <FullScreenMessage title="Page introuvable" /> },
])
