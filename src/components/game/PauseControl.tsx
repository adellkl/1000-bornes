import { UserX } from 'lucide-react'
import { useState } from 'react'
import type { GameState } from '../../types/game'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'

/** Joueur courant déconnecté : l'hôte peut le retirer (après confirmation) pour débloquer la partie */
export function PauseControl({ state, onKick, busy }: { state: GameState; onKick: (id: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false)
  const stuck = state.players.find(
    (p) =>
      !p.is_connected &&
      (p.id === state.room.current_player_id || p.id === state.room.pending_attack?.target_id),
  )
  if (!state.room.is_host || !stuck || stuck.id === state.room.host_player_id) return null

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-night-800 px-4 py-3 ring-1 ring-flame-500/40">
        <p className="text-sm font-semibold">
          <span className="font-extrabold">{stuck.name}</span> ne répond plus. Attendez son retour ou retirez-le.
        </p>
        <Button variant="danger" loading={busy} onClick={() => setOpen(true)} icon={<UserX className="size-4" />}>
          Retirer
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        title={`Retirer ${stuck.name} de la partie ?`}
        confirmLabel="Retirer"
        danger
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false)
          onKick(stuck.id)
        }}
      >
        Ses cartes en main partiront à la défausse et le tour passera au joueur suivant. Cette action est définitive.
      </ConfirmDialog>
    </>
  )
}
