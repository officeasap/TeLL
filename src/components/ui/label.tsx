'use client'

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ children, className = '', ...props }: LabelProps) {
  return (
    <label className={`text-sm font-medium text-white ${className}`} {...props}>
      {children}
    </label>
  )
}
