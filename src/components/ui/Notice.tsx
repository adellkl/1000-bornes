import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert } from 'lucide-react'

/** Bandeau d'erreur animé (coup refusé par le serveur, réseau…) */
export function Notice({ message, className = '' }: { message: string | null; className?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12 }}
          className={`flex items-start gap-2 rounded-2xl bg-flame-600 px-4 py-3 text-sm font-bold text-cream-50 shadow-xl ${className}`}
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
