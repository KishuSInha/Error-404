import { motion } from 'framer-motion'

export default function GlassCard({ children, className = '', hover = true, glow = false, onClick }) {
  return (
    <motion.div
      className={`glass p-6 ${glow ? 'shadow-glow-blue' : ''} ${hover ? 'cursor-pointer' : ''} ${className}`}
      whileHover={hover ? { y: -2, boxShadow: '0 0 30px rgba(59,130,246,0.2)' } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )
}
