import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel, danger }: ConfirmDialogProps) {
  // Portail : le dialogue couvre toute la page même s'il est déclaré dans un conteneur fixe
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-end bg-night-950/70 p-4 backdrop-blur-sm sm:place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-full max-w-sm rounded-3xl bg-night-800 p-6 ring-1 ring-cream-100/10"
            initial={{ y: 40, scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-extrabold">{title}</h2>
            {children && <div className="mt-2 text-sm text-night-300">{children}</div>}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="ghost" onClick={onCancel}>
                Annuler
              </Button>
              <Button variant={danger ? 'primary' : 'go'} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
