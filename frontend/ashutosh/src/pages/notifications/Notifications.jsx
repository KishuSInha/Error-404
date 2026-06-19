import { motion } from 'framer-motion'
import { AlertTriangle, Sparkles, Info, CheckCircle2, Clock } from 'lucide-react'
import { notifications } from '../../data/dummyData'

const iconMap = {
  urgent: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ai: { icon: Sparkles, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  success: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
  warning: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
}

export default function Notifications() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Notifications</h1>
        <p className="text-slate-500 text-sm mt-1">Everything your AI thought you should know</p>
      </div>

      <div className="space-y-2">
        {notifications.map((n, i) => {
          const cfg = iconMap[n.type]
          const Icon = cfg.icon
          return (
            <motion.div key={n.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="glass !rounded-2xl p-4 flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                <Icon size={15} className={cfg.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{n.desc}</p>
              </div>
              <span className="text-xs text-slate-600 shrink-0">{n.time}</span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
