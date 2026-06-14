import type { ButtonHTMLAttributes, ReactNode } from 'react'

export const Surface = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`bg-surface rounded-neu shadow-neu ${className}`}>{children}</div>

export const Inset = ({ children, className = '' }: { children: ReactNode; className?: string }) =>
  <div className={`bg-surface rounded-xl shadow-neu-inset ${className}`}>{children}</div>

export function Button({ children, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return <button {...p}
    className={`bg-gradient-to-b from-accent2 to-accent text-[#06101f] font-bold rounded-xl px-4 py-3 shadow-neu-sm active:shadow-neu-inset disabled:opacity-50 ${className}`}>
    {children}</button>
}
