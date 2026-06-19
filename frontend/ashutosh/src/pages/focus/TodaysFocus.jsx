import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Circle, Flame, Coffee, Sparkles } from 'lucide-react'
import { tasks as initialTasks } from '../../data/dummyData'
import Badge from '../../components/ui/Badge'
import GlassCard from '../../components/ui/GlassCard'

export default function TodaysFocus() {
  const [tasks, setTasks] = useState(
    initialTasks.filter(t => t.priority !== 'P3').slice(0, 6).map(t => ({ ...t }))
  )
  const [focusMode, setFocusMode] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'completed' ? 'todo' : 'completed' } : t))
  }

  const completed = tasks.filter(t => t.status === 'completed').length
  const progress = Math.round((completed / tasks.length) * 100)
  const remaining = tasks.filter(t => t.status !== 'completed')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Today's Focus</h1>
          <p className="text-slate-500 text-sm mt-1">{remaining.length} tasks left to clear your plate</p>
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setFocusMode(!focusMode)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 text-orange-400 text-sm font-medium">
          <Flame size={15} />
          {focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
        </motion.button>
      </div>

      {/* Progress bar */}
      <GlassCard hover={false} className="!p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">Daily progress</span>
          <span className="text-sm font-bold gradient-text">{progress}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6 }}
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
        </div>
      </GlassCard>

      <AnimatePresence mode="wait">
        {focusMode ? (
          <motion.div key="focus" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
            {remaining.length > 0 ? (
              <div className="glass p-10 text-center space-y-6">
                <Sparkles className="mx-auto text-cyan-400" size={28} />
                <div>
                  <Badge label={remaining[currentIdx % remaining.length]?.priority} type={remaining[currentIdx % remaining.length]?.priority} />
                  <h2 className="text-2xl font-display font-bold text-white mt-3">
                    {remaining[currentIdx % remaining.length]?.title}
                  </h2>
                  <p className="text-slate-500 text-sm mt-2">
                    {remaining[currentIdx % remaining.length]?.category} · Est. {remaining[currentIdx % remaining.length]?.effort}h
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => toggleTask(remaining[currentIdx % remaining.length]?.id)}
                    className="px-6 py-3 rounded-2xl bg-green-500/20 border border-green-500/30 text-green-400 font-medium text-sm hover:bg-green-500/30 transition-colors">
                    Mark Complete
                  </button>
                  <button
                    onClick={() => setCurrentIdx(i => i + 1)}
                    className="px-6 py-3 rounded-2xl bg-white/5 border border-white/10 text-slate-300 font-medium text-sm hover:bg-white/10 transition-colors">
                    Skip for now
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass p-10 text-center">
                <Coffee className="mx-auto text-cyan-400 mb-3" size={28} />
                <p className="text-white font-semibold">All clear! Time for a break.</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {tasks.map((task, i) => (
              <motion.div key={task.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className={`glass !rounded-2xl p-4 flex items-center gap-4 transition-all ${task.status === 'completed' ? 'opacity-50' : ''}`}>
                <button onClick={() => toggleTask(task.id)} className="shrink-0">
                  {task.status === 'completed' ? (
                    <CheckCircle2 size={22} className="text-green-400" />
                  ) : (
                    <Circle size={22} className="text-slate-600 hover:text-blue-400 transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-white'}`}>
                    {task.title}
                  </p>
                  <p className="text-xs text-slate-500">{task.category} · Due {task.deadline}</p>
                </div>
                <Badge label={task.priority} type={task.priority} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
