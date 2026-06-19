import { motion } from 'framer-motion'
import { tasks } from '../../data/dummyData'
import Badge from '../../components/ui/Badge'

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function assignTasksToDay(dayIndex) {
  return tasks.filter((_, i) => i % 7 === dayIndex)
}

export default function WeeklyPlan() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white">Weekly Plan</h1>
        <p className="text-slate-500 text-sm mt-1">AI-balanced workload across your week</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((day, di) => {
          const dayTasks = assignTasksToDay(di)
          const isToday = di === new Date().getDay() - 1
          return (
            <motion.div key={day} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: di * 0.05 }}
              className={`glass !rounded-2xl p-3 min-h-[220px] ${isToday ? 'border-blue-500/40 bg-blue-500/5' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-semibold uppercase tracking-wider ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>{day}</span>
                {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400">Today</span>}
              </div>
              <div className="space-y-2">
                {dayTasks.length === 0 && <p className="text-xs text-slate-700 italic">No tasks</p>}
                {dayTasks.map(t => (
                  <div key={t.id} className="p-2 rounded-xl bg-white/4 border border-white/6">
                    <p className="text-xs text-white leading-snug">{t.title}</p>
                    <div className="mt-1.5"><Badge label={t.priority} type={t.priority} /></div>
                  </div>
                ))}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
