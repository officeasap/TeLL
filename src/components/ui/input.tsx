'use client'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-xl bg-[#0a0a0a] shadow-[inset_4px_4px_8px_#050505,inset_-2px_-2px_4px_#1f1f1f] focus:outline-none focus:shadow-[inset_4px_4px_8px_#050505,inset_-2px_-2px_4px_#1f1f1f,0_0_0_2px_#1E2A78] text-white placeholder-[#F5F5F5]/50 px-5 py-3 text-base ${className}`}
      {...props}
    />
  )
}
