import { motion } from 'framer-motion'
import { tasks } from '../../data/dummyData'

const priorityColor = { P1: '#EF4444', P2: '#F59E0B', P3: '#3B82F6' }

export default function DependencyMap() {
  const blockedTasks = tasks.filter(t => t.deps.length > 0)
  const cols = tasks.slice(0, 8)
  const positions = cols.map((t, i) => ({
    ...t,
    x: 80 + (i % 4) * 220,
    y: 80 + Math.floor(i / 4) * 180,
  }))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Dependency Map</h1>
        <p className="text-slate-500 text-sm mt-1">See which tasks are blocking others before they pile up</p>
      </div>

      <div className="glass p-6 overflow-x-auto">
        <svg width="100%" height="420" viewBox="0 0 920 420">
          {positions.map(task => {
            if (task.deps.length === 0) return null
            const target = positions.find(p => task.deps.includes(p.id))
            if (!target) return null
            return (
              <motion.line key={task.id}
                x1={target.x + 80} y1={target.y + 30}
                x2={task.x} y2={task.y + 30}
                stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="5 5"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }}
                markerEnd="url(#arrow)"
              />
            )
          })}
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#8B5CF6" />
            </marker>
          </defs>

          {positions.map((task, i) => (
            <motion.g key={task.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
              <rect x={task.x} y={task.y} width="170" height="60" rx="16"
                fill="rgba(255,255,255,0.04)" stroke={task.blocked ? '#EF4444' : priorityColor[task.priority]} strokeWidth="1.2" strokeOpacity="0.5" />
              <rect x={task.x} y={task.y} width="4" height="60" rx="2" fill={priorityColor[task.priority]} />
              <text x={task.x + 14} y={task.y + 24} fill="white" fontSize="11" fontWeight="600" fontFamily="Inter">
                {task.title.length > 20 ? task.title.slice(0, 20) + '…' : task.title}
              </text>
              <text x={task.x + 14} y={task.y + 42} fill="#64748B" fontSize="9" fontFamily="monospace">
                {task.category} · {task.priority}
              </text>
              {task.blocked && (
                <text x={task.x + 150} y={task.y + 18} fill="#EF4444" fontSize="11">⛔</text>
              )}
            </motion.g>
          ))}
        </svg>
      </div>

      <div className="glass p-5">
        <p className="text-sm font-medium text-slate-300 mb-3">Blocked Tasks</p>
        {blockedTasks.length === 0 ? (
          <p className="text-sm text-slate-600">Nothing is currently blocked. Smooth sailing.</p>
        ) : (
          <div className="space-y-2">
            {blockedTasks.map(task => {
              const blocker = tasks.find(t => task.deps.includes(t.id))
              return (
                <div key={task.id} className="flex items-center gap-2 text-sm p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                  <span className="text-white font-medium">{task.title}</span>
                  <span className="text-slate-500">is waiting on</span>
                  <span className="text-purple-400 font-medium">{blocker?.title}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
