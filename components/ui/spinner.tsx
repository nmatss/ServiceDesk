import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'white' | 'gray'
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-3',
  xl: 'h-12 w-12 border-4',
}

const colorClasses = {
  primary: 'border-blue-600 border-t-transparent',
  secondary: 'border-gray-600 border-t-transparent',
  white: 'border-white border-t-transparent',
  gray: 'border-gray-400 border-t-transparent',
}

export function Spinner({ size = 'md', color = 'primary', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'inline-block rounded-full animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      role="status"
      aria-label="Carregando"
    >
      <span className="sr-only">Carregando...</span>
    </div>
  )
}

export function SpinnerOverlay({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 flex flex-col items-center gap-4 shadow-xl">
        <Spinner size="xl" color="primary" />
        {message && (
          <p className="text-gray-700 dark:text-gray-300 font-medium">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

export function InlineSpinner({ text, size = 'sm' }: { text?: string; size?: 'sm' | 'md' }) {
  return (
    <div className="flex items-center gap-2">
      <Spinner size={size} color="primary" />
      {text && (
        <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>
      )}
    </div>
  )
}

export function ButtonSpinner({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return <Spinner size={size} color="white" />
}
