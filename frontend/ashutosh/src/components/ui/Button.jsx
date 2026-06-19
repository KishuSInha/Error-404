import { motion } from 'framer-motion'

export default function Button({ children, variant = 'primary', size = 'md', onClick, className = '', disabled = false }) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-2xl transition-all duration-200 disabled:opacity-50'
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-5 py-2.5 text-sm', lg: 'px-7 py-3 text-base' }
  const variants = {
    primary: 'bg-electric-500 hover:bg-electric-400 text-white shadow-glow-blue',
    secondary: 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10',
    ghost: 'hover:bg-white/5 text-slate-400 hover:text-white',
    danger: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30',
    cyan: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 shadow-glow-cyan',
  }
  return (
    <motion.button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </motion.button>
  )
}
