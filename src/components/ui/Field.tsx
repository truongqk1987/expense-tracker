import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
} from 'react'

const controlBase =
  'w-full min-h-11 rounded-lg border bg-surface px-3 text-sm text-ink ' +
  'placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/30 ' +
  'focus:border-brand transition-colors'

export function Label({
  htmlFor,
  children,
}: {
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-ink">
      {children}
    </label>
  )
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="mt-1 text-xs text-danger">{children}</p>
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  ref?: Ref<HTMLInputElement>
}

export function Input({ invalid, className = '', ...rest }: InputProps) {
  return (
    <input
      className={`${controlBase} ${invalid ? 'border-danger' : 'border-line'} ${className}`}
      {...rest}
    />
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  ref?: Ref<HTMLSelectElement>
  children: ReactNode
}

export function Select({ invalid, className = '', children, ...rest }: SelectProps) {
  return (
    <select
      className={`${controlBase} ${invalid ? 'border-danger' : 'border-line'} ${className}`}
      {...rest}
    >
      {children}
    </select>
  )
}
