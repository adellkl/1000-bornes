import { Navigate, useParams } from 'react-router-dom'
import { GameHeader } from '../components/game/GameHeader'
import { RoomLobby } from '../components/lobby/RoomLobby'
import { FullScreenMessage } from '../components/ui/FullScreenMessage'
import { Notice } from '../components/ui/Notice'
import { useGame } from '../hooks/useGame'

export default function LobbyPage() {
  const { roomCode = '' } = useParams()
  const code = roomCode.toUpperCase()
  const game = useGame(code)
  const { state } = game

  if (game.loading) return <FullScreenMessage loading />
  if (!state) return <FullScreenMessage title="Salle introuvable">{game.error}</FullScreenMessage>
  if (!state.me) return <Navigate to={`/join/${code}`} replace />
  if (state.room.status !== 'lobby') return <Navigate to={`/game/${code}`} replace />

  return (
    <main className="min-h-app bg-asphalt">
      <GameHeader code={code} live={game.live} />
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-10 pt-4">
        <div className="rounded-3xl bg-night-800/60 p-5 text-center ring-1 ring-cream-100/10">
          <div className="font-display text-2xl">Vous êtes dans la course !</div>
          <p className="mt-1 text-sm text-night-300">Gardez cette page ouverte : vos cartes apparaîtront ici.</p>
        </div>
        <Notice message={game.actionError} />
        <RoomLobby state={state} busy={game.busy} onStart={game.startGame} onKick={game.kickPlayer} />
      </div>
    </main>
  )
}
