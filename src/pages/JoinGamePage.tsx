import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { JoinRoom } from '../components/lobby/JoinRoom'
import { FullScreenMessage } from '../components/ui/FullScreenMessage'
import { Logo } from '../components/ui/Logo'
import { useRealtimeRoom } from '../hooks/useRealtimeRoom'
import { call } from '../lib/firebase'

export default function JoinGamePage() {
  const { roomCode = '' } = useParams()
  const code = roomCode.toUpperCase()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const claim = params.get('claim')
  const [claimError, setClaimError] = useState<string | null>(null)
  const claimed = useRef(false)
  const { state, error, loading, refresh } = useRealtimeRoom(claim ? undefined : code)

  // L'hôte reprend sa place sur son téléphone via son QR personnel
  useEffect(() => {
    if (!claim || claimed.current) return
    claimed.current = true
    call('claimseat', { code, token: claim })
      .then(() => navigate(`/game/${code}`, { replace: true }))
      .catch((e: Error) => setClaimError(e.message))
  }, [claim, code, navigate])

  if (claim) {
    return claimError ? (
      <FullScreenMessage title="Impossible de reprendre votre place">
        <p className="text-night-300">{claimError}</p>
      </FullScreenMessage>
    ) : (
      <FullScreenMessage loading title="Récupération de votre place…" />
    )
  }
  if (loading) return <FullScreenMessage loading />
  if (error || !state) {
    return (
      <FullScreenMessage title="Salle introuvable">
        <p className="text-night-300">Vérifiez le code « {code} » auprès de l’hôte.</p>
      </FullScreenMessage>
    )
  }
  if (state.me) return <Navigate to={state.room.status === 'lobby' ? `/lobby/${code}` : `/game/${code}`} replace />

  const disabledReason =
    state.room.status !== 'lobby'
      ? 'La partie a déjà commencé.'
      : state.players.length >= state.room.max_players
        ? 'La salle est complète.'
        : null

  return (
    <main className="flex min-h-dvh flex-col items-center bg-asphalt px-5 py-8">
      <Logo />
      <div className="mt-10 w-full max-w-sm rounded-[2rem] bg-night-800/85 p-6 ring-1 ring-cream-100/10">
        <JoinRoom
          code={code}
          disabledReason={disabledReason}
          onJoin={async (name) => {
            await call('joinroom', { code, name })
            await refresh()
            navigate(`/lobby/${code}`)
          }}
        />
      </div>
      <p className="mt-6 text-center text-sm text-night-300">
        {state.players.length} joueur{state.players.length > 1 ? 's' : ''} déjà en salle
      </p>
    </main>
  )
}
