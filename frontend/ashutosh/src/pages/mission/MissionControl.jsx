import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { tasks } from '../../data/dummyData'

const priorityConfig = {
  P1: { color: '#EF4444', size: 14 },
  P2: { color: '#F59E0B', size: 11 },
  P3: { color: '#3B82F6', size: 9 },
}

const statusColors = { todo: '#475569', in_progress: '#3B82F6', completed: '#10B981' }

function TaskOrbit({ task, index, total, radius, onHover, hoveredId }) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius
  const cfg = priorityConfig[task.priority]
  const isHovered = hoveredId === task.id

  return (
    <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.06 }}>
      {task.priority === 'P1' && (
        <motion.line x1="0" y1="0" x2={x} y2={y} stroke={cfg.color} strokeWidth="0.5" strokeOpacity="0.2" strokeDasharray="4 4"
          animate={{ strokeOpacity: [0.1, 0.3, 0.1] }} transition={{ duration: 3, repeat: Infinity, delay: index * 0.2 }} />
      )}
      <motion.g transform={`translate(${x}, ${y})`} style={{ cursor: 'pointer' }}
        onMouseEnter={() => onHover(task.id)} onMouseLeave={() => onHover(null)}
        animate={{ scale: isHovered ? 1.4 : 1 }} transition={{ type: 'spring', stiffness: 400 }}>
        {task.priority === 'P1' && (
          <motion.circle r={cfg.size + 6} fill="none" stroke={cfg.color} strokeWidth="1"
            animate={{ r: [cfg.size + 6, cfg.size + 14], opacity: [0.6, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }} />
        )}
        <motion.circle r={cfg.size / 2 + 5} fill={cfg.color} fillOpacity={0.15} />
        <circle r={cfg.size / 2} fill={cfg.color} />
        <circle cx={cfg.size / 2 - 2} cy={-(cfg.size / 2 - 2)} r="3" fill={statusColors[task.status]} stroke="#0B1020" strokeWidth="1" />
      </motion.g>
    </motion.g>
  )
}

export default function MissionControl() {
  const [hoveredId, setHoveredId] = useState(null)
  const hoveredTask = tasks.find(t => t.id === hoveredId)

  const p1Tasks = tasks.filter(t => t.priority === 'P1')
  const p2Tasks = tasks.filter(t => t.priority === 'P2')
  const p3Tasks = tasks.filter(t => t.priority === 'P3')

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Mission Control</h1>
          <p className="text-slate-500 text-sm mt-1">Your task universe — visualized as an orbital system</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {[['P1', '#EF4444'], ['P2', '#F59E0B'], ['P3', '#3B82F6']].map(([p, c]) => (
            <div key={p} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <div className="glass p-4" style={{ minHeight: 560 }}>
            <svg width="100%" viewBox="-320 -320 640 640" style={{ maxHeight: 520 }}>
              {[80, 150, 220, 290].map(r => (
                <circle key={r} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="6 6" />
              ))}
              <text x="85" y="-5" fill="rgba(239,68,68,0.5)" fontSize="9" fontFamily="monospace">P1 ORBIT</text>
              <text x="155" y="-5" fill="rgba(245,158,11,0.4)" fontSize="9" fontFamily="monospace">P2 ORBIT</text>
              <text x="225" y="-5" fill="rgba(59,130,246,0.3)" fontSize="9" fontFamily="monospace">P3 ORBIT</text>

              {tasks.filter(t => t.deps.length > 0).map(task => {
                const toTask = tasks.find(t => task.deps.includes(t.id))
                if (!toTask) return null
                const fromIdx = tasks.indexOf(task)
                const toIdx = tasks.indexOf(toTask)
                const fromR = task.priority === 'P1' ? 90 : task.priority === 'P2' ? 160 : 230
                const toR = toTask.priority === 'P1' ? 90 : toTask.priority === 'P2' ? 160 : 230
                const fa = (fromIdx / tasks.length) * 2 * Math.PI - Math.PI / 2
                const ta = (toIdx / tasks.length) * 2 * Math.PI - Math.PI / 2
                return (
                  <line key={task.id} x1={Math.cos(fa) * fromR} y1={Math.sin(fa) * fromR}
                    x2={Math.cos(ta) * toR} y2={Math.sin(ta) * toR}
                    stroke="#8B5CF6" strokeWidth="0.8" strokeOpacity="0.25" strokeDasharray="3 5" />
                )
              })}

              {p1Tasks.map((task, i) => (
                <TaskOrbit key={task.id} task={task} index={i} total={p1Tasks.length} radius={90} onHover={setHoveredId} hoveredId={hoveredId} />
              ))}
              {p2Tasks.map((task, i) => (
                <TaskOrbit key={task.id} task={task} index={i} total={p2Tasks.length} radius={160} onHover={setHoveredId} hoveredId={hoveredId} />
              ))}
              {p3Tasks.map((task, i) => (
                <TaskOrbit key={task.id} task={task} index={i} total={p3Tasks.length} radius={230} onHover={setHoveredId} hoveredId={hoveredId} />
              ))}

              <circle r="36" fill="url(#centerGrad)" />
              <circle r="36" fill="none" stroke="url(#borderGrad)" strokeWidth="2" />
              <motion.circle r="42" fill="none" stroke="#3B82F6" strokeWidth="1" strokeOpacity="0.3"
                animate={{ r: [42, 50], opacity: [0.3, 0] }} transition={{ duration: 2.5, repeat: Infinity }} />
              <text textAnchor="middle" y="5" fill="white" fontSize="14" fontWeight="700" fontFamily="'Space Grotesk'">A</text>
              <text textAnchor="middle" y="-10" fill="rgba(255,255,255,0.5)" fontSize="7" fontFamily="monospace">YOU</text>

              <defs>
                <radialGradient id="centerGrad">
                  <stop offset="0%" stopColor="#1E3A5F" />
                  <stop offset="100%" stopColor="#0B1020" />
                </radialGradient>
                <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <AnimatePresence mode="wait">
            {hoveredTask ? (
              <motion.div key={hoveredTask.id}
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                className="glass p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${hoveredTask.priority === 'P1' ? 'bg-red-500/20 text-red-400' : hoveredTask.priority === 'P2' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {hoveredTask.priority}
                    </span>
                    <span className="text-xs text-slate-500">{hoveredTask.category}</span>
                  </div>
                  <h3 className="text-white font-semibold">{hoveredTask.title}</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Status</span>
                    <span className={`font-medium ${hoveredTask.status === 'in_progress' ? 'text-blue-400' : hoveredTask.status === 'completed' ? 'text-green-400' : 'text-slate-400'}`}>
                      {hoveredTask.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Deadline</span>
                    <span className="text-white">{hoveredTask.deadline}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Effort</span>
                    <span className="text-white">{hoveredTask.effort}h</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Impact</span>
                    <span className={`font-medium ${hoveredTask.impact === 'CRITICAL' ? 'text-red-400' : hoveredTask.impact === 'HIGH' ? 'text-orange-400' : 'text-yellow-400'}`}>
                      {hoveredTask.impact}
                    </span>
                  </div>
                  {hoveredTask.blocked && (
                    <div className="mt-2 p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                      ⛔ This task is blocked
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass p-5 text-center">
                <div className="text-4xl mb-3">🎯</div>
                <p className="text-slate-400 text-sm">Hover over any task node to see details</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass p-4 space-y-3">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Mission Stats</p>
            {[
              { label: 'Critical (P1)', count: p1Tasks.length, color: '#EF4444' },
              { label: 'High (P2)', count: p2Tasks.length, color: '#F59E0B' },
              { label: 'Standard (P3)', count: p3Tasks.length, color: '#3B82F6' },
              { label: 'Blocked', count: tasks.filter(t => t.blocked).length, color: '#8B5CF6' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-slate-400">{label}</span>
                </div>
                <span className="font-bold text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
