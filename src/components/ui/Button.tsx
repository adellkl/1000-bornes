import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'go'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-flame-500 text-cream-50 shadow-[0_5px_0_0_var(--color-flame-700)] hover:bg-flame-400 active:translate-y-[3px] active:shadow-[0_2px_0_0_var(--color-flame-700)]',
  go: 'bg-go-500 text-cream-50 shadow-[0_5px_0_0_var(--color-go-600)] hover:bg-go-400 active:translate-y-[3px] active:shadow-[0_2px_0_0_var(--color-go-600)]',
  secondary:
    'bg-cream-100 text-night-900 shadow-[0_5px_0_0_var(--color-cream-300)] hover:bg-cream-50 active:translate-y-[3px] active:shadow-[0_2px_0_0_var(--color-cream-300)]',
  ghost: 'bg-night-800/70 text-cream-100 ring-1 ring-cream-100/15 hover:bg-night-700',
  danger: 'bg-night-800 text-flame-400 ring-1 ring-flame-500/50 hover:bg-flame-500/15',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  icon?: ReactNode
  size?: 'md' | 'lg'
}

export function Button({ variant = 'primary', loading, icon, size = 'md', className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-5 font-extrabold transition-[transform,box-shadow,background-color] duration-100 disabled:opacity-50 disabled:active:translate-y-0 ${
        size === 'lg' ? 'min-h-14 px-5 text-lg sm:px-7' : 'text-base'
      } ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <LoaderCircle className="size-5 animate-spin" /> : icon}
      {children}
    </button>
  )
}
