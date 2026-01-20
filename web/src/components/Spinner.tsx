import { clsx } from 'clsx'

export type SpinnerProps = {
  label?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Spinner({ label = 'Loading', size = 'sm', className }: SpinnerProps) {
  const sizeClass = size === 'sm' ? 'h-3 w-3 border-2' : 'h-4 w-4 border-2'

  return (
    <span role="status" aria-label={label} className={clsx('inline-flex items-center', className)}>
      <span
        aria-hidden="true"
        className={clsx('animate-spin rounded-full border-border border-t-primary-400', sizeClass)}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}

