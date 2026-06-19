import { motion } from 'framer-motion'

export default function StatCard({ label, value, icon: Icon, color = 'blue', trend, delay = 0 }) {
  const colors = {
    blue: { bg: 'from-blue-600/20 to-blue-800/5', icon: 'text-blue-400', border: 'border-blue-500/20' },
    cyan: { bg: 'from-cyan-600/20 to-cyan-800/5', icon: 'text-cyan-400', border: 'border-cyan-500/20' },
    purple: { bg: 'from-purple-600/20 to-purple-800/5', icon: 'text-purple-400', border: 'border-purple-500/20' },
    red: { bg: 'from-red-600/20 to-red-800/5', icon: 'text-red-400', border: 'border-red-500/20' },
    green: { bg: 'from-green-600/20 to-green-800/5', icon: 'text-green-400', border: 'border-green-500/20' },
  }
  const c = colors[color]
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${c.bg} border ${c.border} p-5`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{label}</p>
          <p className="text-3xl font-bold font-display text-white">{value}</p>
          {trend && <p className="text-xs text-green-400 mt-1">↑ {trend}</p>}
        </div>
        {Icon && <div className={`p-2.5 rounded-2xl bg-white/5 ${c.icon}`}><Icon size={20} /></div>}
      </div>
    </motion.div>
  )
}
