'use client'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'link' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

export function Button({ children, className = '', variant = 'default', size = 'default', ...props }: ButtonProps) {
  const baseClasses = 'rounded-xl font-medium transition-all px-4 py-2'
  
  const variants = {
    default: 'neumorph-btn-primary',
    outline: 'neumorph-btn-gray border border-[#1E2A78] bg-transparent text-white',
    link: 'text-[#1E2A78] hover:underline bg-transparent shadow-none',
    ghost: 'bg-transparent hover:bg-[#1E2A78]/20 text-white shadow-none'
  }
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    default: 'px-5 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  }
  
  const variantClass = variants[variant] || variants.default
  const sizeClass = sizes[size] || sizes.default
  
  return (
    <button className={`${variantClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </button>
  )
}
