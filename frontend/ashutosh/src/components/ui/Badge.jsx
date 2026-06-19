const variants = {
  P1: 'bg-red-500/20 text-red-400 border-red-500/30',
  P2: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  P3: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CRITICAL: 'bg-red-600/30 text-red-300 border-red-600/40',
  HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-green-500/20 text-green-400 border-green-500/30',
  todo: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  blocked: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function Badge({ label, type }) {
  const cls = variants[type || label] || 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}
